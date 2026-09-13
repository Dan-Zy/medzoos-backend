const { initFollowUpJobs } = require('./follow-up-overdue.job');
const { logger } = require('../utils/logger');

const initJobs = () => {
  try {
    initFollowUpJobs();
    logger.info('Background jobs initialized (follow-up overdue)');
  } catch (err) {
    logger.error(`Failed to init jobs: ${err.message}`);
  }
};

module.exports = { initJobs };
