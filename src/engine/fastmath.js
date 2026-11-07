// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Math.hypot, fast. The game calls it hundreds of places a frame (distances on the ground, every foe, every solid), and
// the engine's built-in is a slow generic call that boxes its numbers: a measurable share of the frame's work and of
// its garbage. Two or three numbers (every call the game makes) take the plain square root; a result that overflowed
// or met a NaN/Infinity goes back to the built-in, so the answers are the built-in's.
const native = Math.hypot;
Math.hypot = function hypot(a, b, c){
  const n = arguments.length;
  let r;
  if (n === 2) r = Math.sqrt(a * a + b * b);
  else if (n === 3) r = Math.sqrt(a * a + b * b + c * c);
  else return native.apply(Math, arguments);
  return r === r && r !== Infinity ? r : native.apply(Math, arguments);
};
