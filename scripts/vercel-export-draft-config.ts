import { DRAFT_GAME_CONFIG } from '../tests/fixtures/draft-game-config';

// This is an unapproved playtest draft. The fixture module is the single source of truth.
process.stdout.write(JSON.stringify(DRAFT_GAME_CONFIG));
