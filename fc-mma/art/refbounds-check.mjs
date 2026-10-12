import { toPix } from './pixellab-check.mjs'
const D = process.argv[2]
for (const f of ['Idle/rotations/south.png', 'Idle/rotations/east.png', 'lying_on_his_back_c/rotations/south.png', 'lying_on_his_back_c/rotations/east.png', 'Idle/animations/Running/south/frame_000.png', 'Idle/animations/the_referee_whistles_with_a_whistle_and_then_holds/south/frame_000.png', 'Idle/animations/the_referee_whistles_with_a_whistle_and_then_holds/south/frame_008.png']) {
  const p = toPix(D + '/b/' + f, false); const b = p.bounds()
  console.log(f.padEnd(90), p.w + 'x' + p.h, 'bounds', b.x, b.y, b.w, b.h, 'feet', b.y + b.h - 1, 'cx', b.x + b.w / 2, 'couleurs', p.colours)
}
