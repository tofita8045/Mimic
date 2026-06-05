// Imports the Python contract source as a raw string (Vite ?raw loader).
// We bundle it so the user can deploy directly from the app.
import source from "../../contracts/mimic.py?raw";

export const MIMIC_SOURCE: string = source;
