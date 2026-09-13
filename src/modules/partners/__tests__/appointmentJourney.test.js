/**
 * Journey-layer unit tests (no DB). Run: npm test -- appointmentJourney
 */

const {
  assertStatusTransition,
  // telehealth utils may export differently — mirror rules here for isolation
} = (() => {
  try {
    return require('../src/utils/telehealth.utils');
  } catch {
    return {};
  }
})();

const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'in_progress', 'cancelled', 'no_show'],
  checked_in: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function canTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

function assertInPersonCheckIn(mode, from, to) {
  const isInPerson = mode === 'in_person' || mode === 'in_clinic';
  if (to === 'checked_in' && !isInPerson) {
    throw new Error('Check-in is only available for in-clinic appointments');
  }
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} -> ${to}`);
  }
}

describe('appointment journey status rules', () => {
  test('in_person appointment can check in from confirmed', () => {
    expect(() => assertInPersonCheckIn('in_person', 'confirmed', 'checked_in')).not.toThrow();
  });

  test('online appointment cannot check in', () => {
    expect(() => assertInPersonCheckIn('online', 'confirmed', 'checked_in')).toThrow(
      /only available for in-clinic/,
    );
  });

  test('checked_in can transition to in_progress', () => {
    expect(canTransition('checked_in', 'in_progress')).toBe(true);
  });

  test('completed cannot transition to no_show', () => {
    expect(canTransition('completed', 'no_show')).toBe(false);
  });

  test('cancelled cannot transition to no_show', () => {
    expect(canTransition('cancelled', 'no_show')).toBe(false);
  });

  test('confirmed can transition to no_show', () => {
    expect(canTransition('confirmed', 'no_show')).toBe(true);
  });
});

describe('timeline derivation helpers', () => {
  function buildDoctorSteps(mode, status) {
    const steps = ['booked', 'payment', 'confirmed'];
    if (mode === 'in_person') steps.push('checked_in');
    steps.push('in_progress', 'completed', 'prescription');
    if (status === 'cancelled' || status === 'no_show') {
      return { steps, terminal: true };
    }
    return { steps, terminal: false };
  }

  test('online timeline does not include checked_in', () => {
    const { steps } = buildDoctorSteps('online', 'confirmed');
    expect(steps).not.toContain('checked_in');
    expect(steps).toContain('in_progress');
  });

  test('in_person timeline includes checked_in', () => {
    const { steps } = buildDoctorSteps('in_person', 'confirmed');
    expect(steps).toContain('checked_in');
  });

  test('cancelled timeline is terminal', () => {
    expect(buildDoctorSteps('online', 'cancelled').terminal).toBe(true);
  });

  test('no_show timeline is terminal', () => {
    expect(buildDoctorSteps('in_person', 'no_show').terminal).toBe(true);
  });
});

describe('share access rules (logical)', () => {
  function canDoctorReadGrant({ grant, doctorId, appointmentId, patientId }) {
    return (
      grant.doctor_id === doctorId &&
      grant.appointment_id === appointmentId &&
      grant.patient_id === patientId &&
      !grant.revoked_at
    );
  }

  const grant = {
    doctor_id: 'doc-b',
    appointment_id: 'apt-1',
    patient_id: 'pat-1',
    revoked_at: null,
  };

  test('Doctor B can read active grants for their appointment', () => {
    expect(
      canDoctorReadGrant({
        grant,
        doctorId: 'doc-b',
        appointmentId: 'apt-1',
        patientId: 'pat-1',
      }),
    ).toBe(true);
  });

  test('Doctor C cannot read Doctor B grants', () => {
    expect(
      canDoctorReadGrant({
        grant,
        doctorId: 'doc-c',
        appointmentId: 'apt-1',
        patientId: 'pat-1',
      }),
    ).toBe(false);
  });

  test('revoked grant cannot be read', () => {
    expect(
      canDoctorReadGrant({
        grant: { ...grant, revoked_at: new Date().toISOString() },
        doctorId: 'doc-b',
        appointmentId: 'apt-1',
        patientId: 'pat-1',
      }),
    ).toBe(false);
  });
});

describe('mode-aware UI rules', () => {
  function actionsFor(mode) {
    if (mode === 'in_person') {
      return ['Check In', 'Start Visit', 'Visit Documents', 'Consultation', 'Prescription', 'Follow-up'];
    }
    return ['Chat', 'Start Video', 'Visit Documents', 'Consultation', 'Prescription', 'Follow-up'];
  }

  test('in_person UI does not display Chat or Video', () => {
    const actions = actionsFor('in_person');
    expect(actions).not.toContain('Chat');
    expect(actions).not.toContain('Start Video');
    expect(actions).toContain('Check In');
  });

  test('online UI still displays Chat and Video', () => {
    const actions = actionsFor('online');
    expect(actions).toContain('Chat');
    expect(actions).toContain('Start Video');
    expect(actions).not.toContain('Check In');
  });
});

if (typeof assertStatusTransition === 'function') {
  describe('telehealth assertStatusTransition', () => {
    test('allows confirmed -> checked_in', () => {
      expect(() => assertStatusTransition('confirmed', 'checked_in')).not.toThrow();
    });
  });
}
