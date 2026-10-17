import * as migration_20261015_100204_initial from './20261015_100204_initial';
import * as migration_20261015_101800_content_refinements from './20261015_101800_content_refinements';
import * as migration_20261015_124033_public_content_and_consultant from './20261015_124033_public_content_and_consultant';
import * as migration_20261015_130330_withdrawn_shortlink_targets from './20261015_130330_withdrawn_shortlink_targets';
import * as migration_20261016_120000_service_pages from './20261016_120000_service_pages';
import * as migration_20261017_203641_analytics from './20261017_203641_analytics';

export const migrations = [
  {
    up: migration_20261015_100204_initial.up,
    down: migration_20261015_100204_initial.down,
    name: '20261015_100204_initial',
  },
  {
    up: migration_20261015_101800_content_refinements.up,
    down: migration_20261015_101800_content_refinements.down,
    name: '20261015_101800_content_refinements',
  },
  {
    up: migration_20261015_124033_public_content_and_consultant.up,
    down: migration_20261015_124033_public_content_and_consultant.down,
    name: '20261015_124033_public_content_and_consultant',
  },
  {
    up: migration_20261015_130330_withdrawn_shortlink_targets.up,
    down: migration_20261015_130330_withdrawn_shortlink_targets.down,
    name: '20261015_130330_withdrawn_shortlink_targets',
  },
  {
    up: migration_20261016_120000_service_pages.up,
    down: migration_20261016_120000_service_pages.down,
    name: '20261016_120000_service_pages',
  },
  {
    up: migration_20261017_203641_analytics.up,
    down: migration_20261017_203641_analytics.down,
    name: '20261017_203641_analytics'
  },
];
