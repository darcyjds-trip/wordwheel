# Word Wheel Modes

## Arcade Mode

Arcade is the score-chasing solo mode.

### Word Values

- 4-letter word: `100`
- 5-letter word: `200`
- 6-letter word: `350`
- 7-letter word: `500`

Each word score is:

`base word value x survival multiplier`

Example:

- 6-letter word at `x1.30` survival = `350 x 1.30 = 455`

### Survival Multiplier

- Starts at `x1.00`
- Increases by `+0.10` after clearing a full round
- Caps at `x3.00`
- Resets to `x1.00` if time runs out or the player skips

### Round Bonuses

When a round is fully cleared, the player earns:

- Round clear bonus: `+400`
- Perfect order bonus: `+250`
  - This applies if the round is solved in this exact order:
  - `4 -> 5 -> 6 -> 7`
- Time bonus: `+10` for each second left on the clock

Round bonus formula:

`(400 + order bonus + time bonus) x survival multiplier`

### Session Format

- Each run lasts `8 rounds`
- Every arcade round requires:
  - one 4-letter word
  - one 5-letter word
  - one 6-letter word
  - one 7-letter word

## Puzzle Mode

Puzzle is the hidden-answer solo mode.

- No score tracking
- No survival multiplier
- Each round has a `2 minute` timer
- Every round contains mystery words in `5-letter`, `6-letter`, `7-letter`, and `8-letter` groups
- Each mystery word shows clue letters from the start
- If the round is skipped or time expires, the unsolved answers are revealed before the board moves on or ends
- Clear all `8 rounds` to complete the run

## Hunt Mode

Hunt is another hidden-answer solo mode.

- No score tracking
- No survival multiplier
- Each round has a `2 minute` timer
- Every round contains hidden words in `5-letter`, `6-letter`, `7-letter`, and `8-letter` groups
- The hidden board stays on screen while the wheel changes after each solve
- Each new wheel combo is chosen to unlock one of the remaining answers on the board
- Every word starts with clue letters already revealed
- Clear all `8 rounds` to complete the run

## Theme Mode

Theme mode is a themed hidden-answer solo mode.

- No score tracking
- No survival multiplier
- Each round has a `2 minute` timer
- Every round is built from one named theme, such as Nature or Sky
- The hidden board is grouped into `5-letter`, `6-letter`, `7-letter`, and `8-letter` words
- The game picks the themed answers first, then rotates the wheel to 3-letter combos that unlock one of the remaining themed words
- Every word starts with clue letters already revealed
- Clear all `8 rounds` to complete the run

## Multiplayer

Multiplayer uses the arcade-style `4 -> 5 -> 6 -> 7` board format in a shared 8-round race.
