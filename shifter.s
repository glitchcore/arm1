.text
mov     r1, pc        @ inspect status and mode
mov     r2, #12
movs    pc, r2
nop
nop
mov     r2, #1        @ initial distance to shift
mov     r1, #15       @ constant value to shift
ldr     r3, pointer
loop:
ror     r0, r1, r2
add     r2, r2, #1
str     r0, [r3], #4  @ write to results array
b       loop
pointer:
.word results
results:
.word 0xaa55aa55
