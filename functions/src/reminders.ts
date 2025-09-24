import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { DateTime } from "luxon";

const firestore = admin.firestore();
const messaging = admin.messaging();
const fieldValue = admin.firestore.FieldValue;

const BATCH_SIZE = 100;
const RETRY_DELAY_MINUTES = 30;

type ReminderSubscription = {
  token?: string;
  reminderTime?: string;
  reminderHour?: number;
  reminderMinute?: number;
  timezone?: string;
  nextNotificationAt?: FirebaseFirestore.Timestamp;
  lastNotificationSentAt?: FirebaseFirestore.Timestamp;
  active?: boolean;
};

function parseReminderTime(data: ReminderSubscription): { hour: number; minute: number } | null {
  if (typeof data.reminderHour === "number" && typeof data.reminderMinute === "number") {
    return { hour: data.reminderHour, minute: data.reminderMinute };
  }

  if (typeof data.reminderTime === "string") {
    const [hour, minute] = data.reminderTime.split(":").map((value) => Number.parseInt(value, 10));
    if (Number.isInteger(hour) && Number.isInteger(minute)) {
      return { hour, minute };
    }
  }

  return null;
}

function calculateNextNotification(
  data: ReminderSubscription,
  now: DateTime,
): Date | null {
  const timezone = data.timezone ?? "UTC";
  const parsed = parseReminderTime(data);

  if (!parsed) {
    return null;
  }

  const base = now.setZone(timezone);
  if (!base.isValid) {
    return null;
  }

  let next = DateTime.fromObject(
    { hour: parsed.hour, minute: parsed.minute, second: 0, millisecond: 0 },
    { zone: timezone },
  );

  if (!next.isValid) {
    return null;
  }

  if (next <= base) {
    next = next.plus({ days: 1 });
  }

  return next.toUTC().toJSDate();
}

function isUnrecoverableTokenError(error: unknown): boolean {
  if (typeof error !== "object" || !error) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument";
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "object" && error) {
    return JSON.stringify(error);
  }

  return String(error);
}

async function hasLoggedMealToday(userId: string, timezone: string): Promise<boolean> {
  try {
    // Get today's date in the user's timezone
    const userToday = DateTime.now().setZone(timezone);
    if (!userToday.isValid) {
      functions.logger.warn("Invalid timezone for meal check", { userId, timezone });
      return false; // If timezone is invalid, don't skip reminder
    }

    // Create start and end of day timestamps in user's timezone, then convert to UTC
    const startOfDay = userToday.startOf('day').toUTC();
    const endOfDay = userToday.endOf('day').toUTC();

    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay.toJSDate());
    const endTimestamp = admin.firestore.Timestamp.fromDate(endOfDay.toJSDate());

    // Query meals for today
    const mealsQuery = firestore
      .collection('users')
      .doc(userId)
      .collection('meals')
      .where('date', '>=', startTimestamp)
      .where('date', '<=', endTimestamp)
      .limit(1); // We only need to know if any meal exists

    const snapshot = await mealsQuery.get();
    const hasMeals = !snapshot.empty;

    functions.logger.info("Meal check for today", {
      userId,
      timezone,
      userToday: userToday.toISODate(),
      hasMeals,
      mealCount: snapshot.size
    });

    return hasMeals;
  } catch (error) {
    functions.logger.error("Error checking today's meals", {
      error: describeError(error),
      userId,
      timezone
    });
    return false; // If error, don't skip reminder (fail safe)
  }
}

export const sendDueDinnerReminders = functions.scheduler
  .onSchedule("every 5 minutes", async () => {
    const now = DateTime.utc();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now.toJSDate());
    let processed = 0;

    let query = firestore
      .collectionGroup("notificationSubscriptions")
      .where("active", "==", true)
      .where("nextNotificationAt", "<=", nowTimestamp)
      .orderBy("nextNotificationAt")
      .limit(BATCH_SIZE);

    while (true) {
      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      for (const docSnap of snapshot.docs) {
        processed += 1;
        const data = docSnap.data() as ReminderSubscription;
        const userId = docSnap.ref.parent.parent?.id ?? "unknown";
        const timezone = data.timezone ?? "UTC";

        if (!data.token) {
          functions.logger.warn("Skipping reminder without token", { userId, docPath: docSnap.ref.path });
          await docSnap.ref.update({
            active: false,
            deliveryStatus: "missing-token",
            updatedAt: fieldValue.serverTimestamp(),
          });
          continue;
        }

        const nextDate = calculateNextNotification(data, now);
        if (!nextDate) {
          functions.logger.error("Unable to calculate next reminder time", {
            userId,
            docPath: docSnap.ref.path,
            timezone,
            reminderTime: data.reminderTime,
            reminderHour: data.reminderHour,
            reminderMinute: data.reminderMinute,
          });
          await docSnap.ref.update({
            active: false,
            deliveryStatus: "invalid-config",
            updatedAt: fieldValue.serverTimestamp(),
            nextNotificationAt: fieldValue.delete(),
          });
          continue;
        }

        // Check if user has already logged a meal today (skip test notifications)
        const isTestNotification = docSnap.ref.path.includes('test-dinner');
        if (!isTestNotification) {
          const hasLoggedToday = await hasLoggedMealToday(userId, timezone);
          if (hasLoggedToday) {
            functions.logger.info("Skipping reminder - user already logged meal today", {
              userId,
              docPath: docSnap.ref.path,
              timezone,
            });
            // Update next notification time but mark as skipped
            await docSnap.ref.update({
              lastNotificationAttemptAt: nowTimestamp,
              nextNotificationAt: admin.firestore.Timestamp.fromDate(nextDate),
              deliveryStatus: "skipped-meal-logged",
              updatedAt: fieldValue.serverTimestamp(),
            });
            continue;
          }
        }

        try {
          await messaging.send({
            token: data.token,
            notification: {
              title: "🍽️ Dinner Time!",
              body: "What did you eat for dinner today?",
            },
            data: {
              type: "dinner-reminder",
              reminderTime: data.reminderTime ?? "",
              timezone,
              userId,
            },
            android: {
              priority: "high",
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
          });

          await docSnap.ref.update({
            lastNotificationSentAt: nowTimestamp,
            lastNotificationAttemptAt: nowTimestamp,
            nextNotificationAt: admin.firestore.Timestamp.fromDate(nextDate),
            deliveryStatus: "sent",
            deliveryError: fieldValue.delete(),
            updatedAt: fieldValue.serverTimestamp(),
          });
        } catch (error) {
          const errorDescription = describeError(error);
          const unrecoverable = isUnrecoverableTokenError(error);
          const retryDate = unrecoverable
            ? null
            : now.plus({ minutes: RETRY_DELAY_MINUTES }).toJSDate();

          functions.logger.error("Failed to send reminder", {
            error: errorDescription,
            userId,
            docPath: docSnap.ref.path,
            unrecoverable,
          });

          await docSnap.ref.update({
            lastNotificationAttemptAt: nowTimestamp,
            deliveryStatus: unrecoverable ? "deactivated" : "error",
            deliveryError: errorDescription,
            updatedAt: fieldValue.serverTimestamp(),
            active: unrecoverable ? false : true,
            nextNotificationAt: unrecoverable || !retryDate
              ? fieldValue.delete()
              : admin.firestore.Timestamp.fromDate(retryDate),
          });
        }
      }

      query = query.startAfter(lastDoc);
    }

    functions.logger.info("sendDueDinnerReminders completed", { processed });
  });
