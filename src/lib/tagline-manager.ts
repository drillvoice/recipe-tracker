// Tagline rotation system with randomized timing and sequence

const TAGLINES = [
  "What's cooking, good looking?🍳",
  "Track it, taste it, treasure it 🍛",
  "What's for dinner, winner? 🏆🍴",
  "Feast your eyes, chef surprise 👀👨‍🍳",
  "Spice it up, buttercup 🌶️😉",
  "You're the snack, what's the meal? 😋🍴",
  "Hot dish alert: it's you 🫦🍳"
];

interface TaglineState {
  currentTagline: string;
  nextChangeTime: number;
  usedIndexes: number[];
  lastResetTime: number;
}

export class TaglineManager {
  private static readonly STORAGE_KEY = 'dish-diary-tagline-state';
  private static readonly MIN_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
  private static readonly MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Get the current tagline, rotating if needed
   */
  static getCurrentTagline(): string {
    const state = this.getTaglineState();
    const now = Date.now();

    // Check if it's time to rotate
    if (now >= state.nextChangeTime) {
      return this.rotateTagline();
    }

    return state.currentTagline;
  }

  /**
   * Get stored tagline state or initialize with defaults
   */
  private static getTaglineState(): TaglineState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as TaglineState;

        // Validate the state
        if (state.currentTagline &&
            typeof state.nextChangeTime === 'number' &&
            Array.isArray(state.usedIndexes) &&
            typeof state.lastResetTime === 'number') {
          return state;
        }
      }
    } catch (error) {
      console.warn('Error loading tagline state:', error);
    }

    // Initialize with first tagline
    return this.initializeTaglineState();
  }

  /**
   * Initialize tagline state with random first selection
   */
  private static initializeTaglineState(): TaglineState {
    const randomIndex = Math.floor(Math.random() * TAGLINES.length);
    const now = Date.now();

    const state: TaglineState = {
      currentTagline: TAGLINES[randomIndex],
      nextChangeTime: now + this.getRandomDuration(),
      usedIndexes: [randomIndex],
      lastResetTime: now
    };

    this.saveTaglineState(state);
    return state;
  }

  /**
   * Rotate to next tagline with randomized selection
   */
  private static rotateTagline(): string {
    const state = this.getTaglineState();
    const now = Date.now();

    // If we've used all taglines, reset the cycle
    if (state.usedIndexes.length >= TAGLINES.length) {
      state.usedIndexes = [];
      state.lastResetTime = now;
    }

    // Get available taglines (not yet used in current cycle)
    const availableIndexes = TAGLINES.map((_, index) => index)
      .filter(index => !state.usedIndexes.includes(index));

    // Select random tagline from available options
    const randomAvailableIndex = Math.floor(Math.random() * availableIndexes.length);
    const selectedIndex = availableIndexes[randomAvailableIndex];

    // Update state
    state.currentTagline = TAGLINES[selectedIndex];
    state.usedIndexes.push(selectedIndex);
    state.nextChangeTime = now + this.getRandomDuration();

    this.saveTaglineState(state);
    return state.currentTagline;
  }

  /**
   * Generate random duration between min and max
   */
  private static getRandomDuration(): number {
    const range = this.MAX_DURATION_MS - this.MIN_DURATION_MS;
    return this.MIN_DURATION_MS + Math.floor(Math.random() * range);
  }

  /**
   * Save tagline state to localStorage
   */
  private static saveTaglineState(state: TaglineState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Error saving tagline state:', error);
    }
  }

  /**
   * Get debug info about current tagline state
   */
  static getDebugInfo(): {
    currentTagline: string;
    timeUntilNext: string;
    cycleProgress: string;
    totalTaglines: number;
  } {
    const state = this.getTaglineState();
    const now = Date.now();
    const timeUntilNext = Math.max(0, state.nextChangeTime - now);

    const days = Math.floor(timeUntilNext / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeUntilNext % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeUntilNext % (60 * 60 * 1000)) / (60 * 1000));

    return {
      currentTagline: state.currentTagline,
      timeUntilNext: `${days}d ${hours}h ${minutes}m`,
      cycleProgress: `${state.usedIndexes.length}/${TAGLINES.length}`,
      totalTaglines: TAGLINES.length
    };
  }

  /**
   * Force rotation to next tagline (for testing)
   */
  static forceRotation(): string {
    return this.rotateTagline();
  }

  /**
   * Reset tagline system (for testing)
   */
  static reset(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Error resetting tagline state:', error);
    }
  }
}