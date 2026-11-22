// The welcome screen shows once each time the app starts (good for demos), then never again until restart.
let seen = false;
export const introSeen = () => seen;
export const markIntroSeen = () => { seen = true; };
