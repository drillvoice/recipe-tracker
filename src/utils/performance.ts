// Performance testing utilities

export interface PerformanceResult {
  operation: string;
  duration: number;
  itemCount?: number;
  averageTime?: number;
}

export function measurePerformance<T>(
  operation: string,
  fn: () => T,
  iterations: number = 1
): PerformanceResult {
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    results.push(end - start);
  }
  
  const totalTime = results.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  
  return {
    operation,
    duration: totalTime,
    averageTime,
    itemCount: iterations
  };
}

export async function measureAsyncPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  iterations: number = 1
): Promise<PerformanceResult> {
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    results.push(end - start);
  }
  
  const totalTime = results.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  
  return {
    operation,
    duration: totalTime,
    averageTime,
    itemCount: iterations
  };
}

export function logPerformanceResult(result: PerformanceResult): void {
  console.log(`Performance: ${result.operation}`);
  console.log(`Total time: ${result.duration.toFixed(2)}ms`);
  if (result.averageTime) {
    console.log(`Average time: ${result.averageTime.toFixed(2)}ms`);
  }
  if (result.itemCount && result.itemCount > 1) {
    console.log(`Items processed: ${result.itemCount}`);
  }
}