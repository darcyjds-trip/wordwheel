# Letter Clock Scoring

## Word Values

- 4-letter word: `100`
- 5-letter word: `200`
- 6-letter word: `350`
- 7-letter word: `500`

Each word score is:

`base word value x survival multiplier`

Example:

- 6-letter word at `x1.30` survival = `350 x 1.30 = 455`

## Survival Multiplier

- Starts at `x1.00`
- Increases by `+0.10` after clearing a full round
- Caps at `x3.00`
- Resets to `x1.00` if time runs out or the player skips

## Round Bonuses

When a round is fully cleared, the player earns:

- Round clear bonus: `+400`
- Perfect order bonus: `+250`
  - This applies if the round is solved in this exact order:
  - `4 -> 5 -> 6 -> 7`
- Time bonus: `+10` for each second left on the clock

Round bonus formula:

`(400 + order bonus + time bonus) x survival multiplier`

## Session Format

- Each run lasts `8 rounds`
- Every round requires:
  - one 4-letter word
  - one 5-letter word
  - one 6-letter word
  - one 7-letter word

## Example Round

If the player has `x1.20` survival and scores:

- 4-letter word = `120`
- 5-letter word = `240`
- 6-letter word = `420`
- 7-letter word = `600`

That subtotal is:

`1380`

If they finish in perfect order and have `12` seconds left:

- Round bonus = `400 + 250 + 120 = 770`
- Multiplied by survival: `770 x 1.20 = 924`

Total round score:

`1380 + 924 = 2304`
