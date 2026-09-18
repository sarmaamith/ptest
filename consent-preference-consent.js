(function () {
  // ============================================================
  // Securiti consent_upload — same request shape used across the
  // other demo pages in this project.
  //
  // SECURITY NOTE: this runs client-side on a public page, so
  // anything in SECURITI_HEADERS is visible to anyone who views
  // source / opens devtools. For a real deployment, proxy this call
  // through a small backend (Cloudflare Worker, Lambda, etc.) that
  // holds the real key/secret server-side, and have the page call
  // that proxy instead of app.securiti.ai directly.
  //
  // No Securiti tenant was supplied for this particular form, so
  // the values below are placeholders — swap in the real endpoint
  // and X-API-Key / X-API-Secret / X-TIDENT for your tenant before
  // going live.
  // ============================================================
  const SECURITI_ENDPOINT = 'https://app.securiti.ai/privaci/v1/consentapi/consent_upload';
  const SECURITI_HEADERS = {
    'X-API-Key': 'GYsPcqTmOKEXcXq7M15ElbXOsga80rk0W367rmk9',
    'X-API-Secret': '85fzFjPye5XzO8yjXLsa9bP0Ol3zcPjl5Yd17bXM',
    'X-TIDENT': '09f99b07-9b72-4dd3-b6b5-1009a96c2fd4',
    'Content-Type': 'application/json'
  };
  const FORM_SELECTOR = '#consentForm';
  const inFlight = new WeakSet();

  // ============================================================
  // readForm — pull the personal-detail fields and every consent
  // checkbox by id. Every checkbox is read regardless of whether
  // it's checked, since unticked boxes must still be reported as
  // an explicit "No" (per the form's own footer text), never
  // omitted from the payload.
  // ============================================================
  function readForm(form) {
    const get = function (id) {
      const el = form.querySelector('#' + id);
      return el && el.value ? el.value.trim() : '';
    };
    const checked = function (id) {
      const el = form.querySelector('#' + id);
      return !!(el && el.checked);
    };
    return {
      fullName: get('fullName'),
      age:      get('age'),
      email:    get('email'),
      phone:    get('phone'),
      address:  get('address'),

      callGranted:          checked('consentCall'),
      smsGranted:           checked('consentSMS'),
      emailMarketingGranted: checked('consentEmailMarketing'),

      sellGranted:          checked('consentSell'),
      aiTrainingGranted:    checked('consentAiTraining'),
      shareVendorGranted:   checked('consentShareVendor')
    };
  }

  // ============================================================
  // isValid — the five personal-detail fields are required; every
  // consent checkbox in both sections is optional and never blocks
  // submission (unticked = explicit "No", still recorded).
  // ============================================================
  function isValid(fields) {
    if (!fields.fullName) return false;
    if (!fields.age || isNaN(Number(fields.age)) || Number(fields.age) <= 0) return false;
    if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return false;
    if (!fields.phone) return false;
    if (!fields.address) return false;
    return true;
  }

  // ============================================================
  // buildPayload — Securiti consent_upload schema. Every checkbox
  // is sent as the visitor actually set it — true or false — never
  // hardcoded and never left out when unchecked.
  // ============================================================
  function buildPayload(fields) {
    return {
      UUID: fields.email,
      uuids: {
        email: fields.email,
        phone: fields.phone
      },
      activity_timestamp: Math.floor(Date.now() / 1000),
      consent_source: 'Consent Preference Form',
      consent_info: [
        {
          processing_purpose_name: 'Marketing Communication',
          consented_items: [
            { consent_purpose_name: 'Call',  consent_granted: fields.callGranted },
            { consent_purpose_name: 'SMS',   consent_granted: fields.smsGranted },
            { consent_purpose_name: 'Email', consent_granted: fields.emailMarketingGranted }
          ]
        },
        {
          processing_purpose_name: 'Data Sharing with Third Parties',
          consented_items: [
            { consent_purpose_name: 'Sell',            consent_granted: fields.sellGranted },
            { consent_purpose_name: 'AI Training',     consent_granted: fields.aiTrainingGranted },
            { consent_purpose_name: 'Share to Vendor', consent_granted: fields.shareVendorGranted }
          ]
        }
      ]
    };
  }

  // ============================================================
  // uploadConsent — POST to Securiti
  // ============================================================
  async function uploadConsent(payload) {
    const response = await fetch(SECURITI_ENDPOINT, {
      method:  'POST',
      headers: SECURITI_HEADERS,
      body:    JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Securiti ' + response.status + ': ' + errorText);
    }
    return response.json();
  }

  // ============================================================
  // Submit handler — validate the personal-detail fields, then
  // upload consent with every checkbox's true/false state.
  // ============================================================
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!form || !form.matches || !form.matches(FORM_SELECTOR)) return;
    event.preventDefault();
    if (inFlight.has(form)) return; // duplicate-click guard

    const statusMsg = form.querySelector('#statusMsg');
    const submitBtn = form.querySelector('#submitBtn');
    const fields = readForm(form);

    if (!isValid(fields)) {
      statusMsg.textContent = 'Please fill in your name, age, email, phone number, and address.';
      statusMsg.className = 'status-msg error';
      return;
    }

    statusMsg.textContent = '';
    inFlight.add(form);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const payload = buildPayload(fields);

    uploadConsent(payload)
      .then(function (result) {
        console.log('Consent recorded:', result);
        statusMsg.textContent = 'Your preferences have been saved.';
        statusMsg.className = 'status-msg success';
      })
      .catch(function (err) {
        console.error('Consent upload failed:', err);
        statusMsg.textContent = 'Something went wrong saving your preferences. Please try again.';
        statusMsg.className = 'status-msg error';
      })
      .finally(function () {
        inFlight.delete(form);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit consent';
      });
  }, true);

  // ============================================================
  // Clear button — native type="reset" clears all fields and
  // checkboxes; just clear the status message alongside it.
  // ============================================================
  document.addEventListener('reset', function (event) {
    const form = event.target;
    if (!form || !form.matches || !form.matches(FORM_SELECTOR)) return;
    const statusMsg = form.querySelector('#statusMsg');
    if (statusMsg) {
      statusMsg.textContent = '';
      statusMsg.className = 'status-msg';
    }
  }, true);
})();
