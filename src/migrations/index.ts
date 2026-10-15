import * as migration_20261015_100204_initial from './20261015_100204_initial';
import * as migration_20261015_101800_content_refinements from './20261015_101800_content_refinements';

export const migrations = [
  {
    up: migration_20261015_100204_initial.up,
    down: migration_20261015_100204_initial.down,
    name: '20261015_100204_initial',
  },
  {
    up: migration_20261015_101800_content_refinements.up,
    down: migration_20261015_101800_content_refinements.down,
    name: '20261015_101800_content_refinements'
  },
];
