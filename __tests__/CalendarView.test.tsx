import { render, screen, within } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import CalendarView from "@/components/CalendarView";
import type { Meal } from "@/lib/offline-storage";

jest.mock("@/components/ConfirmDialog", () => () => null);

const loadMealsMock = jest.fn();
const updateMealDataMock = jest.fn();
const deleteMealDataMock = jest.fn();

const useMealsMock = jest.fn();

jest.mock("@/hooks/useMeals", () => ({
  useMeals: () => useMealsMock()
}));

const baseMealsState = {
  loadMeals: loadMealsMock,
  updateMealData: updateMealDataMock,
  deleteMealData: deleteMealDataMock
};

const mockMeals: Meal[] = [
  {
    id: "meal-1",
    mealName: "🍣 Nigiri",
    date: Timestamp.fromDate(new Date("2024-03-05T00:00:00.000Z"))
  },
  {
    id: "meal-2",
    mealName: "🍜 Ramen",
    date: Timestamp.fromDate(new Date("2024-03-05T00:00:00.000Z"))
  },
  {
    id: "meal-3",
    mealName: "Spaghetti",
    date: Timestamp.fromDate(new Date("2024-03-07T00:00:00.000Z"))
  },
  {
    id: "meal-4",
    mealName: "🍔 Burger",
    date: Timestamp.fromDate(new Date("2024-03-08T00:00:00.000Z"))
  }
];

describe("CalendarView", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-03-10T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    useMealsMock.mockReturnValue({
      meals: mockMeals,
      ...baseMealsState
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows only one leading emoji per day even with multiple meals", () => {
    render(<CalendarView />);

    const dayButton = screen.getByRole("button", { name: /March 5, 2024/ });
    const emojiElements = within(dayButton).queryAllByText("🍣");

    expect(emojiElements).toHaveLength(1);
    expect(within(dayButton).queryByText("🍜")).not.toBeInTheDocument();
  });

  it("uses the first meal with a leading emoji when earlier meals lack one", () => {
    const mealsWithNonEmojiLead: Meal[] = [
      {
        id: "meal-5",
        mealName: "Roast Chicken",
        date: Timestamp.fromDate(new Date("2024-03-08T00:00:00.000Z"))
      },
      mockMeals[3]
    ];

    useMealsMock.mockReturnValueOnce({
      meals: mealsWithNonEmojiLead,
      ...baseMealsState
    });

    render(<CalendarView refreshTrigger={1} />);

    const dayButton = screen.getByRole("button", { name: /March 8, 2024/ });
    expect(within(dayButton).getByText("🍔")).toBeInTheDocument();
  });

  it("shows a full leading emoji sequence with modifiers", () => {
    useMealsMock.mockReturnValueOnce({
      meals: [
        {
          id: "meal-6",
          mealName: "👩🏻‍🍳 Pasta",
          date: Timestamp.fromDate(new Date("2024-03-09T00:00:00.000Z"))
        }
      ],
      ...baseMealsState
    });

    render(<CalendarView refreshTrigger={2} />);

    const dayButton = screen.getByRole("button", { name: /March 9, 2024/ });
    expect(within(dayButton).getByText("👩🏻‍🍳")).toBeInTheDocument();
  });

  it("shows leading flag and keycap emoji", () => {
    useMealsMock.mockReturnValueOnce({
      meals: [
        {
          id: "meal-7",
          mealName: "🇯🇵 Curry",
          date: Timestamp.fromDate(new Date("2024-03-11T00:00:00.000Z"))
        },
        {
          id: "meal-8",
          mealName: "1️⃣ Pancakes",
          date: Timestamp.fromDate(new Date("2024-03-12T00:00:00.000Z"))
        }
      ],
      ...baseMealsState
    });

    render(<CalendarView refreshTrigger={3} />);

    const flagDayButton = screen.getByRole("button", { name: /March 11, 2024/ });
    expect(within(flagDayButton).getByText("🇯🇵")).toBeInTheDocument();

    const keycapDayButton = screen.getByRole("button", { name: /March 12, 2024/ });
    expect(within(keycapDayButton).getByText("1️⃣")).toBeInTheDocument();
  });
});
