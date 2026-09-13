const cron = require('node-cron');
const followUpsService = require('../modules/follow-ups/followUps.service');
const { logger } = require('../utils/logger');

function initFollowUpJobs() {
  // Daily 01:15 — mark overdue follow-ups by booking window end
  cron.schedule('15 1 * * *', async () => {
    try {
      const result = await followUpsService.markOverdueFollowUps();
      logger.info(`Follow-up overdue job updated ${result.updated} rows`);
    } catch (err) {
      logger.error(`Follow-up overdue job failed: ${err.message}`);
    }
  });
}

module.exports = { initFollowUpJobs };
