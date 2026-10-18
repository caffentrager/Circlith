// Both URLs use the same source. Vite's build mode controls simulation availability.
export const appMode = import.meta.env.MODE === 'editor' ? 'editor' : 'simulation';
export const simulationAvailable = appMode === 'simulation';
export const settingsKey = (name: string) => `${simulationAvailable ? 'circlith.simulation' : 'circlith'}.${name}`;
