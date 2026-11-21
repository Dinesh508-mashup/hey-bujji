// Every limit used by the heart rate wellness check, in one place.
// Tune these from real recordings: the result screen's "Details" shows the
// measured value next to each limit, so you can see which one decided the result.
//
// These starting values are educated guesses, not validated thresholds.

export const HEART = {
  // --- recording ---
  baselineSeconds: 3,          // room sound, phone held in the hand
  chestSeconds: 20,            // phone pressed on the chest
  sampleRate: 16000,           // requested from the mic; the phone may deliver another rate
  motionIntervalMs: 50,        // motion sensor sample every 50 ms (20 Hz)

  // --- frequency bands (Hz) ---
  heartBand: [20, 150] as [number, number],  // heart sounds (S1/S2) live here
  roomBand: [300, 3000] as [number, number], // voices, TV, fans: "room noise"

  // --- "is it on the chest?" (chest recording compared with the room baseline) ---
  minHeartBandGain: 4,         // heart-band energy on chest must be >= 4x the room baseline
  maxRoomBandGain: 1.5,        // room-band energy on chest must stay <= 1.5x baseline (a pressed phone muffles the room)
  minHeartBandShare: 0.5,      // >= 50% of the chest recording's energy must be in the heart band

  // --- rhythm ---
  minBpm: 40,
  maxBpm: 180,
  minBeats: 10,                // at least 10 beats found in the chest recording
  minPeriodicity: 0.3,         // autocorrelation peak of the beat envelope (0 = random, 1 = perfect rhythm)
  maxIntervalCv: 0.15,         // beat-to-beat variation (std / mean). Higher = messy / uneven -> reject
  maxIntervalOutliers: 0.2,    // at most 20% of beat intervals may be > 30% away from the median

  // --- motion sensor ---
  maxShake: 0.15,              // m/s² std of user acceleration. Above = too much movement
  minBreathingMotion: 0.004,   // std of the slow (breathing) part of gravity, in g. Below = perfectly still (a table)
} as const;

export type HeartFailReason = "not_on_chest" | "no_rhythm" | "too_much_movement" | "noisy";
