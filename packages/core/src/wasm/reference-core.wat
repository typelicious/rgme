;; RGME reference core (WAT source). TIMING / INTEGRATION REFERENCE ONLY.
;; This is NOT an Amiga emulator: it executes no 68000 code and models no OCS chips.
;; It implements the RGME WASM core contract so the host (timing budget, media mount,
;; framebuffer blit, input mask, save state) can be verified end to end and deterministically.
;;
;; Output: 320x256 RGBA. Moving raster bars (from the frame counter), a column ramp seeded by the
;; first four media bytes, a blue channel from the cycle counter, greyscale unless the mounted
;; media starts with the AmigaDOS bootblock magic "DOS", and one lit cell per pressed input bit.
(module
  (memory (export "memory") 22)
  (global $cycles (mut i64) (i64.const 0))
  (global $frame  (mut i32) (i32.const 0))
  (global $input  (mut i32) (i32.const 0))
  (global $mptr   (mut i32) (i32.const 0))
  (global $mlen   (mut i32) (i32.const 0))
  (global $heap   (mut i32) (i32.const 393216))

  (func $is_dos (result i32)
    (if (result i32) (i32.lt_u (global.get $mlen) (i32.const 3))
      (then (i32.const 0))
      (else
        (i32.and
          (i32.and
            (i32.eq (i32.load8_u (global.get $mptr)) (i32.const 68))
            (i32.eq (i32.load8_u (i32.add (global.get $mptr) (i32.const 1))) (i32.const 79)))
          (i32.eq (i32.load8_u (i32.add (global.get $mptr) (i32.const 2))) (i32.const 83))))))

  (func $cell (param $x0 i32) (param $y0 i32)
    (local $dx i32) (local $dy i32)
    (local.set $dy (i32.const 0))
    (block $ydone (loop $yl
      (br_if $ydone (i32.ge_u (local.get $dy) (i32.const 16)))
      (local.set $dx (i32.const 0))
      (block $xdone (loop $xl
        (br_if $xdone (i32.ge_u (local.get $dx) (i32.const 16)))
        (i32.store
          (i32.add (i32.const 65536)
            (i32.shl
              (i32.add
                (i32.mul (i32.add (local.get $y0) (local.get $dy)) (i32.const 320))
                (i32.add (local.get $x0) (local.get $dx)))
              (i32.const 2)))
          (i32.const -1))
        (local.set $dx (i32.add (local.get $dx) (i32.const 1)))
        (br $xl)))
      (local.set $dy (i32.add (local.get $dy) (i32.const 1)))
      (br $yl))))

  (func $draw
    (local $x i32) (local $y i32) (local $r i32) (local $g i32) (local $b i32)
    (local $seed i32) (local $dos i32)
    (local.set $dos (call $is_dos))
    (local.set $seed
      (if (result i32) (i32.ge_u (global.get $mlen) (i32.const 4))
        (then (i32.load (global.get $mptr)))
        (else (i32.const 0))))
    (local.set $b (i32.and (i32.wrap_i64 (i64.shr_u (global.get $cycles) (i64.const 10))) (i32.const 255)))
    (local.set $y (i32.const 0))
    (block $ydone (loop $yl
      (br_if $ydone (i32.ge_u (local.get $y) (i32.const 256)))
      (local.set $x (i32.const 0))
      (block $xdone (loop $xl
        (br_if $xdone (i32.ge_u (local.get $x) (i32.const 320)))
        (local.set $r (i32.shl (i32.and (i32.add (local.get $y) (i32.shl (global.get $frame) (i32.const 1))) (i32.const 63)) (i32.const 2)))
        (local.set $g (i32.and (i32.add (local.get $x) (i32.and (local.get $seed) (i32.const 255))) (i32.const 255)))
        (if (i32.eqz (local.get $dos))
          (then
            (local.set $r (i32.div_u (i32.add (i32.add (local.get $r) (local.get $g)) (local.get $b)) (i32.const 3)))
            (local.set $g (local.get $r))
            (local.set $b (local.get $r))))
        (i32.store
          (i32.add (i32.const 65536) (i32.shl (i32.add (i32.mul (local.get $y) (i32.const 320)) (local.get $x)) (i32.const 2)))
          (i32.or
            (i32.or (local.get $r) (i32.shl (local.get $g) (i32.const 8)))
            (i32.or (i32.shl (local.get $b) (i32.const 16)) (i32.const -16777216))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $xl)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $yl)))
    (if (i32.and (global.get $input) (i32.const 1))  (then (call $cell (i32.const 8)   (i32.const 232))))
    (if (i32.and (global.get $input) (i32.const 2))  (then (call $cell (i32.const 28)  (i32.const 232))))
    (if (i32.and (global.get $input) (i32.const 4))  (then (call $cell (i32.const 48)  (i32.const 232))))
    (if (i32.and (global.get $input) (i32.const 8))  (then (call $cell (i32.const 68)  (i32.const 232))))
    (if (i32.and (global.get $input) (i32.const 16)) (then (call $cell (i32.const 88)  (i32.const 232))))
    (if (i32.and (global.get $input) (i32.const 32)) (then (call $cell (i32.const 108) (i32.const 232)))))

  (func (export "rgme_init")
    (global.set $cycles (i64.const 0)) (global.set $frame (i32.const 0)) (global.set $input (i32.const 0))
    (global.set $mptr (i32.const 0)) (global.set $mlen (i32.const 0)) (global.set $heap (i32.const 393216))
    (call $draw))

  (func (export "rgme_alloc") (param $len i32) (result i32)
    (local $p i32) (local $end i32) (local $have i32)
    (local.set $p (global.get $heap))
    (local.set $end (i32.and (i32.add (i32.add (local.get $p) (local.get $len)) (i32.const 15)) (i32.const -16)))
    (local.set $have (i32.shl (memory.size) (i32.const 16)))
    (if (i32.gt_u (local.get $end) (local.get $have))
      (then
        (drop (memory.grow (i32.shr_u (i32.add (i32.sub (local.get $end) (local.get $have)) (i32.const 65535)) (i32.const 16))))))
    (global.set $heap (local.get $end))
    (local.get $p))

  (func (export "rgme_load_media") (param $ptr i32) (param $len i32) (param $kind i32) (result i32)
    (if (result i32) (i32.ne (local.get $kind) (i32.const 0))
      (then (i32.const 0))
      (else
        (global.set $mptr (local.get $ptr))
        (global.set $mlen (local.get $len))
        (call $draw)
        (i32.const 1))))

  (func (export "rgme_run_frame") (param $budget i32) (result i32)
    (global.set $cycles (i64.add (global.get $cycles) (i64.extend_i32_u (local.get $budget))))
    (global.set $frame (i32.add (global.get $frame) (i32.const 1)))
    (call $draw)
    (local.get $budget))

  (func (export "rgme_framebuffer_ptr") (result i32) (i32.const 65536))
  (func (export "rgme_framebuffer_width") (result i32) (i32.const 320))
  (func (export "rgme_framebuffer_height") (result i32) (i32.const 256))
  (func (export "rgme_set_input") (param $m i32) (global.set $input (local.get $m)))
  (func (export "rgme_reset")
    (global.set $cycles (i64.const 0)) (global.set $frame (i32.const 0)) (global.set $input (i32.const 0))
    (call $draw))
  (func (export "rgme_cycle_counter") (result i64) (global.get $cycles))
  (func (export "rgme_frame_counter") (result i32) (global.get $frame))

  ;; save state: cycles(8) frame(4) input(4)
  (func (export "rgme_state_size") (result i32) (i32.const 16))
  (func (export "rgme_state_save") (param $p i32)
    (i64.store (local.get $p) (global.get $cycles))
    (i32.store (i32.add (local.get $p) (i32.const 8)) (global.get $frame))
    (i32.store (i32.add (local.get $p) (i32.const 12)) (global.get $input)))
  (func (export "rgme_state_load") (param $p i32) (param $len i32)
    (if (i32.ge_u (local.get $len) (i32.const 16))
      (then
        (global.set $cycles (i64.load (local.get $p)))
        (global.set $frame (i32.load (i32.add (local.get $p) (i32.const 8))))
        (global.set $input (i32.load (i32.add (local.get $p) (i32.const 12))))
        (call $draw))))
)
