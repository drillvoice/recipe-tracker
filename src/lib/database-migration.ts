import { getAllMeals as getLegacyMeals, type Meal as LegacyMeal } from './mealsStore';
import { saveMeal, getAllMeals, getCacheMetadata, updateCacheMetadata } from './offline-storage';

/**
 * Migrate data from legacy database to enhanced database
 */
export async function migrateLegacyData(): Promise<{
  success: boolean;
  migratedCount: number;
  errors: string[];
}> {
  const result = {
    success: false,
    migratedCount: 0,
    errors: [] as string[]
  };

  try {
    // Check if migration has already been done
    const migrationStatus = await getCacheMetadata('migration_status');
    if (migrationStatus?.legacyMigrationComplete) {
      return { success: true, migratedCount: 0, errors: [] };
    }

    // Get meals from legacy database
    const legacyMeals = await getLegacyMeals();
    console.log(`Found ${legacyMeals.length} meals in legacy database`);

    // Check if enhanced database already has meals
    const enhancedMeals = await getAllMeals();
    if (enhancedMeals.length > 0 && legacyMeals.length === 0) {
      // Enhanced database already populated, mark migration as complete
      await updateCacheMetadata('migration_status', {
        legacyMigrationComplete: true,
        migrationTimestamp: Date.now(),
        migratedCount: enhancedMeals.length
      });
      return { success: true, migratedCount: 0, errors: [] };
    }

    // Migrate each meal to enhanced database
    for (const legacyMeal of legacyMeals) {
      try {
        await saveMeal(legacyMeal);
        result.migratedCount++;
      } catch (error) {
        result.errors.push(`Failed to migrate meal ${legacyMeal.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Mark migration as complete
    await updateCacheMetadata('migration_status', {
      legacyMigrationComplete: true,
      migrationTimestamp: Date.now(),
      migratedCount: result.migratedCount
    });

    result.success = result.errors.length === 0;
    console.log(`Migration complete: ${result.migratedCount} meals migrated, ${result.errors.length} errors`);

    return result;

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Check if legacy migration is needed
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    const migrationStatus = await getCacheMetadata('migration_status');
    return !migrationStatus?.legacyMigrationComplete;
  } catch (error) {
    return true; // If we can't check, assume migration is needed
  }
}