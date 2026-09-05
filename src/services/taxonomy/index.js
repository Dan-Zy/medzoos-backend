/**
 * Medical Taxonomy Unified Exports
 */

const diabetes = require('./diabetesTaxonomy');
const mentalHealth = require('./mentalHealthTaxonomy');
const generalHealth = require('./generalHealthTaxonomy');
const validator = require('./taxonomyValidator');

module.exports = {
  diabetes,
  mentalHealth,
  generalHealth,
  ...validator,
};
