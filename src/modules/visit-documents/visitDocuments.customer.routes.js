const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const visitDocumentsController = require('./visitDocuments.controller');

router.use(protect, restrictTo('customer'));

router.get('/', visitDocumentsController.listPatientDocuments);
router.post('/', visitDocumentsController.createPatientDocument);
router.post('/from-record', visitDocumentsController.createFromRecord);
router.delete('/:documentId', visitDocumentsController.removePatientDocument);

module.exports = router;
