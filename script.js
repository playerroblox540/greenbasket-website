const STORAGE_KEYS = {
  theme: 'greenbasket-theme',
  staff: 'greenbasket-staff',
  session: 'greenbasket-session',
  applicationForm: 'greenbasket-application-form',
  groupRequirement: 'greenbasket-group-requirement',
  publicAuth: 'greenbasket-public-auth',
  applicationsOpen: 'greenbasket-applications-open',
  applications: 'greenbasket-applications',
  notifications: 'greenbasket-notifications',
};

const OWNER_EMAIL = 'owner@greenbasket.com';
const OWNER_PASSWORD = 'greenbasket123';

const DISCORD_OAUTH = {
  clientId: '1565707617152536678',
  clientSecret: 'ZvtRKkJi9kPHCIdXkTH1U6791LPlJaU4',
  redirectUri: 'http://localhost:8000/applications.html',
  scopes: ['identify', 'email'],
};

const defaultGroupRequirement = {
  groupId: '616609542',
  minimumRoleId: '1',
};

const defaultApplicationForm = [
  {
    id: 'full-name',
    label: 'Full name',
    type: 'text',
    required: true,
    requirements: 'Please enter your full legal name.',
    options: '',
    placeholder: 'Your full name',
  },
  {
    id: 'roblox-user',
    label: 'Roblox username',
    type: 'text',
    required: true,
    requirements: 'This helps us verify your Roblox profile.',
    options: '',
    placeholder: 'Example: GreenBasketUser',
  },
  {
    id: 'discord-user',
    label: 'Discord username',
    type: 'text',
    required: false,
    requirements: 'Optional, but helpful for communication.',
    options: '',
    placeholder: 'username#0001',
  },
  {
    id: 'preferred-role',
    label: 'Preferred role',
    type: 'select',
    required: true,
    requirements: 'Choose the role you would like to apply for.',
    options: 'Cashier, Stock Clerk, Supervisor, Manager',
    placeholder: '',
  },
  {
    id: 'availability',
    label: 'What shift are you available for?',
    type: 'select',
    required: true,
    requirements: 'Please list your preferred working hours.',
    options: 'Morning, Evening, Weekend',
    placeholder: '',
  },
  {
    id: 'experience',
    label: 'Why do you want to work at GreenBasket?',
    type: 'textarea',
    required: true,
    requirements: 'Please explain your experience and motivation in a short paragraph.',
    options: '',
    placeholder: 'Tell us a little about yourself...',
  },
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safePrompt(message, fallback = '') {
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    return window.prompt(message, fallback);
  }

  return fallback;
}

function buildDiscordOAuthUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_OAUTH.clientId,
    redirect_uri: DISCORD_OAUTH.redirectUri,
    response_type: 'code',
    scope: DISCORD_OAUTH.scopes.join(' '),
    prompt: 'consent',
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function completeDiscordLoginFromCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    alert('Discord rejected the redirect URL. Please update the Discord app redirect URI to http://localhost:8000/applications.html or continue with the manual sign-in flow.');
    return;
  }

  if (!code) return;

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_OAUTH.clientId,
        client_secret: DISCORD_OAUTH.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_OAUTH.redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Unable to finish Discord login.');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    if (!userResponse.ok) {
      throw new Error(userData.message || 'Unable to load Discord account.');
    }

    const discordName = userData.global_name || userData.username || 'Discord User';
    setPublicAuth('discord', discordName);

    const authContainer = document.getElementById('public-auth-container');
    const statusBanner = document.getElementById('public-status-banner');
    const publicForm = document.getElementById('public-application-form');

    if (authContainer) authContainer.classList.add('hidden');
    if (statusBanner) statusBanner.classList.remove('hidden');
    if (publicForm) {
      publicForm.classList.remove('hidden');
      renderPublicApplicationForm();
    }

    const discordField = document.getElementById('discordUser');
    if (discordField) discordField.value = discordName;

    const statusLabel = document.getElementById('application-status-label');
    const statusCopy = document.getElementById('application-status-copy');
    const applicationsOpen = getApplicationsOpenState();
    if (statusLabel) {
      statusLabel.textContent = applicationsOpen ? 'Applications are currently open' : 'Applications are currently closed';
    }
    if (statusCopy) {
      statusCopy.textContent = applicationsOpen
        ? `Signed in with Discord: ${discordName}. You can now complete the application.`
        : 'Applications are temporarily closed. Please check back later.';
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = '';
    window.history.replaceState({}, '', cleanUrl.toString());
  } catch (error) {
    console.error('Discord login failed:', error);
    alert(error.message || 'Discord login failed. Please try again.');
  }
}

function ensureDefaultStaffAccounts() {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.staff) || '[]');

  if (!existing.length) {
    const starterStaff = [
      { email: 'manager@greenbasket.com', password: 'manager123', role: 'Manager' },
      { email: 'cashier@greenbasket.com', password: 'cashier123', role: 'Cashier' },
    ];
    localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(starterStaff));
  }

  const existingForm = JSON.parse(localStorage.getItem(STORAGE_KEYS.applicationForm) || 'null');
  if (!existingForm || !existingForm.length) {
    localStorage.setItem(STORAGE_KEYS.applicationForm, JSON.stringify(defaultApplicationForm));
  }

  if (!localStorage.getItem(STORAGE_KEYS.applications)) {
    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.notifications)) {
    localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.applicationsOpen)) {
    localStorage.setItem(STORAGE_KEYS.applicationsOpen, 'open');
  }

  const existingGroupRequirement = JSON.parse(localStorage.getItem(STORAGE_KEYS.groupRequirement) || 'null');
  if (!existingGroupRequirement) {
    localStorage.setItem(STORAGE_KEYS.groupRequirement, JSON.stringify(defaultGroupRequirement));
  }
}

function getStaffAccounts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.staff) || '[]');
}

function getApplicationForm() {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.applicationForm) || 'null');
  if (existing && Array.isArray(existing) && existing.length) return existing;
  localStorage.setItem(STORAGE_KEYS.applicationForm, JSON.stringify(defaultApplicationForm));
  return defaultApplicationForm;
}

function getApplications() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.applications) || '[]');
}

function getNotifications() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.notifications) || '[]');
}

function createNotification(message) {
  const notifications = getNotifications();
  notifications.unshift({
    id: `note-${Date.now()}`,
    message,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications.slice(0, 20)));
}

function getGroupRequirement() {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.groupRequirement) || 'null');
  if (!value) return { ...defaultGroupRequirement };
  return {
    groupId: String(value.groupId || defaultGroupRequirement.groupId),
    minimumRoleId: String(value.minimumRoleId || defaultGroupRequirement.minimumRoleId),
  };
}

function saveGroupRequirement(groupId, minimumRoleId) {
  const sanitizedGroupId = String(groupId || defaultGroupRequirement.groupId).trim();
  const sanitizedMinimumRoleId = String(minimumRoleId || defaultGroupRequirement.minimumRoleId).trim();
  localStorage.setItem(
    STORAGE_KEYS.groupRequirement,
    JSON.stringify({
      groupId: sanitizedGroupId,
      minimumRoleId: sanitizedMinimumRoleId,
    })
  );
}

function getPublicAuth() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.publicAuth) || 'null');
}

function setPublicAuth(method, username) {
  localStorage.setItem(
    STORAGE_KEYS.publicAuth,
    JSON.stringify({
      method,
      username,
      signedInAt: new Date().toISOString(),
    })
  );
}

function getApplicationsOpenState() {
  const state = localStorage.getItem(STORAGE_KEYS.applicationsOpen);
  if (state === 'closed') return false;
  return true;
}

function setApplicationsOpenState(isOpen) {
  localStorage.setItem(STORAGE_KEYS.applicationsOpen, isOpen ? 'open' : 'closed');
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function applyInitialTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  setTheme(savedTheme);
}

function updateUserBadge() {
  const badge = document.getElementById('user-badge');
  if (!badge) return;

  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  if (!session) {
    badge.textContent = 'Guest';
    return;
  }

  badge.textContent = session.isOwner ? 'Owner' : session.email;
}

function setupPublicNavigation() {
  const staffLink = document.getElementById('staff-link');
  if (!staffLink) return;

  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  if (session) {
    staffLink.textContent = 'Staff Panel';
    staffLink.href = 'staff-panel.html';
  } else {
    staffLink.textContent = 'Staff Login';
    staffLink.href = 'staff-login.html';
  }
}

function handleThemeToggle() {
  const current = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(current);
}

function setupThemeControls() {
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', handleThemeToggle);
  });
}

function setupSettingsForm() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const publicAuth = getPublicAuth();
  const discordField = document.getElementById('discordAccountValue');
  const robloxField = document.getElementById('robloxAccountValue');

  if (discordField) {
    discordField.textContent = publicAuth && publicAuth.method === 'discord' ? publicAuth.username : 'N/A';
  }

  if (robloxField) {
    robloxField.textContent = publicAuth && publicAuth.method === 'roblox' ? publicAuth.username : 'N/A';
  }

  document.querySelectorAll('[data-signout]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.signout;
      if (!type) return;

      const auth = getPublicAuth();
      if (!auth || auth.method !== type) {
        alert(`No ${type} account is signed in.`);
        return;
      }

      localStorage.removeItem(STORAGE_KEYS.publicAuth);
      window.location.reload();
    });
  });
}

function authWithRobloxOrDiscord(method) {
  if (method === 'discord') {
    const discordAuthUrl = buildDiscordOAuthUrl();
    window.location.href = discordAuthUrl;
    return;
  }

  const label = method === 'roblox' ? 'Roblox' : 'Discord';
  const defaultValue = method === 'roblox' ? 'GreenBasketUser' : 'GreenBasket#0001';
  const username = safePrompt(`Enter your ${label} username or ID to continue:`, defaultValue);

  if (!username) {
    return;
  }

  if (method === 'roblox') {
    const groupRequirement = getGroupRequirement();
    const minimumRoleId = Number(groupRequirement.minimumRoleId || defaultGroupRequirement.minimumRoleId);
    const roleId = safePrompt(
      `Your Roblox group requirement is: join group ${groupRequirement.groupId} and have role ID at least ${minimumRoleId}.\n\nEnter your Roblox group role ID to continue:`,
      String(minimumRoleId)
    );

    if (roleId === null || roleId === '') {
      alert('You must enter a Roblox group role ID to continue.');
      return;
    }

    const parsedRoleId = Number(roleId);
    if (!Number.isFinite(parsedRoleId) || parsedRoleId < minimumRoleId) {
      alert(`Your Roblox role ID is too low. You must be at least role ID ${minimumRoleId} in group ${groupRequirement.groupId}.`);
      return;
    }

    const hiddenField = document.getElementById('roblox-group-role-id');
    if (hiddenField) hiddenField.value = String(parsedRoleId);
  }

  setPublicAuth(method, username);
  alert(`${label} connected successfully. You may now complete the application.`);

  const authContainer = document.getElementById('public-auth-container');
  const statusBanner = document.getElementById('public-status-banner');
  const publicForm = document.getElementById('public-application-form');

  if (authContainer) authContainer.classList.add('hidden');
  if (statusBanner) statusBanner.classList.remove('hidden');
  if (publicForm) {
    publicForm.classList.remove('hidden');
    renderPublicApplicationForm();
  }

  const robloxField = document.getElementById('robloxUser');
  const discordField = document.getElementById('discordUser');
  const robloxInput = document.querySelector('[data-field="roblox"]');
  const discordInput = document.querySelector('[data-field="discord"]');

  if (robloxField) robloxField.value = method === 'roblox' ? username : '';
  if (discordField) discordField.value = method === 'discord' ? username : '';
  if (robloxInput && method === 'roblox') robloxInput.value = username;
  if (discordInput && method === 'discord') discordInput.value = username;

  const statusLabel = document.getElementById('application-status-label');
  const statusCopy = document.getElementById('application-status-copy');
  const applicationsOpen = getApplicationsOpenState();
  statusBanner.classList.toggle('closed', !applicationsOpen);

  if (statusLabel) {
    statusLabel.textContent = applicationsOpen ? 'Applications are currently open' : 'Applications are currently closed';
  }

  if (statusCopy) {
    statusCopy.textContent = applicationsOpen
      ? `Signed in with ${label}: ${username}. You can now complete the application.`
      : 'Applications are temporarily closed. Please check back later.';
  }
}

function renderPublicApplicationForm() {
  const container = document.getElementById('public-application-form');
  if (!container) return;

  const selectedRole = container.dataset.selectedRole || '';
  const roleOptions = ['Cashier', 'Stock Clerk', 'Supervisor', 'Manager'];

  if (!selectedRole) {
    container.innerHTML = `
      <div class="application-role-picker">
        ${roleOptions
          .map(
            (role) => `
              <button class="role-application-btn" type="button" data-role-choice="${escapeHtml(role)}">
                ${escapeHtml(role)}
              </button>
            `
          )
          .join('')}
      </div>
    `;

    container.querySelectorAll('[data-role-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        container.dataset.selectedRole = button.dataset.roleChoice;
        renderPublicApplicationForm();
      });
    });

    return;
  }

  const standardFields = [
    {
      id: 'preferredRole',
      label: 'Preferred role',
      type: 'select',
      required: true,
      helper: 'Choose the role you would like to apply for.',
      options: 'Cashier, Stock Clerk, Supervisor, Manager',
      value: selectedRole,
    },
    {
      id: 'availability',
      label: 'What shift are you available for?',
      type: 'select',
      required: true,
      helper: 'Please list your preferred working hours.',
      options: 'Morning, Evening, Weekend',
    },
  ];

  container.innerHTML = standardFields
    .map((field) => {
      const requiredTag = field.required ? '<span class="required-pill">Required</span>' : '<span class="optional-pill">Optional</span>';
      const options = (field.options || '').split(',').map((value) => value.trim()).filter(Boolean);

      let inputMarkup = '';
      if (field.type === 'textarea') {
        inputMarkup = `<textarea name="${field.id}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(field.placeholder || '')}"></textarea>`;
      } else if (field.type === 'select') {
        const optionMarkup = options.length
          ? options
              .map(
                (value) =>
                  `<option value="${escapeHtml(value)}" ${field.value && field.value === value ? 'selected' : ''}>${escapeHtml(value)}</option>`
              )
              .join('')
          : '<option value="">Choose an option</option>';
        inputMarkup = `<select name="${field.id}" ${field.required ? 'required' : ''}>${optionMarkup}</select>`;
      } else {
        inputMarkup = `<input type="text" name="${field.id}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(field.placeholder || '')}" />`;
      }

      return `
        <div class="application-question">
          <div class="application-question-header">
            <h3>${escapeHtml(field.label)}</h3>
            ${requiredTag}
          </div>
          <p class="field-help">${escapeHtml(field.helper)}</p>
          ${inputMarkup}
        </div>
      `;
    })
    .join('') + '<button class="primary-btn" type="submit">Submit application</button>';
}

function handlePublicApplicationSubmit(event) {
  event.preventDefault();

  if (!getApplicationsOpenState()) {
    alert('Applications are currently closed. Please try again later.');
    return;
  }

  const form = event.currentTarget;
  const groupRequirement = getGroupRequirement();
  const robloxRoleIdValue = form.querySelector('#roblox-group-role-id')?.value;

  if (robloxRoleIdValue !== undefined && robloxRoleIdValue !== null && robloxRoleIdValue !== '') {
    const parsedRoleId = Number(robloxRoleIdValue);
    const minimumRoleId = Number(groupRequirement.minimumRoleId || defaultGroupRequirement.minimumRoleId);
    if (!Number.isFinite(parsedRoleId) || parsedRoleId < minimumRoleId) {
      alert(`Your Roblox role ID must be at least ${minimumRoleId} for group ${groupRequirement.groupId}.`);
      return;
    }
  }

  const app = {
    id: `app-${Date.now()}`,
    fullName: form.elements.fullName?.value.trim() || '',
    robloxUser: form.elements.robloxUser?.value.trim() || '',
    discordUser: form.elements.discordUser?.value.trim() || '',
    preferredRole: form.elements.preferredRole?.value || '',
    availability: form.elements.availability?.value || '',
    experience: form.elements.experience?.value.trim() || '',
    status: 'Pending',
    submittedAt: new Date().toISOString(),
  };

  if (!app.fullName || !app.robloxUser || !app.preferredRole || !app.availability || !app.experience) {
    alert('Please fill in all required fields before submitting.');
    return;
  }

  const applications = getApplications();
  applications.unshift(app);
  localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(applications));

  createNotification(`New application submitted by ${app.fullName} (${app.robloxUser}) and marked as Pending.`);

  alert('Application submitted successfully. We will review it soon.');
  form.reset();
}

function updateGroupRequirementNotice() {
  const requirementBox = document.querySelector('.social-signin p');
  if (!requirementBox) return;

  const groupRequirement = getGroupRequirement();
  requirementBox.innerHTML = `Applicants can sign in using Roblox or Discord. The Roblox group ID is <strong>${escapeHtml(groupRequirement.groupId)}</strong>, and applicants must have a minimum role ID of <strong>${escapeHtml(groupRequirement.minimumRoleId)}</strong> to continue.`;
}

function setupApplications() {
  const form = document.getElementById('public-application-form');
  const authContainer = document.getElementById('public-auth-container');
  const statusBanner = document.getElementById('public-status-banner');
  const publicAuth = getPublicAuth();
  const applicationsOpen = getApplicationsOpenState();

  if (!form || !authContainer || !statusBanner) return;

  const statusLabel = document.getElementById('application-status-label');
  const statusCopy = document.getElementById('application-status-copy');

  if (publicAuth) {
    authContainer.classList.add('hidden');
    statusBanner.classList.remove('hidden');
    form.classList.remove('hidden');
    renderPublicApplicationForm();
    statusBanner.classList.toggle('closed', !applicationsOpen);
    if (statusLabel) {
      statusLabel.textContent = applicationsOpen ? 'Applications are currently open' : 'Applications are currently closed';
    }
    if (statusCopy) {
      statusCopy.textContent = applicationsOpen
        ? `Signed in with ${publicAuth.method}: ${publicAuth.username}. You can now complete the application.`
        : 'Applications are temporarily closed. Please check back later.';
    }
  } else {
    authContainer.classList.remove('hidden');
    statusBanner.classList.add('hidden');
    form.classList.add('hidden');
  }

  form.addEventListener('submit', handlePublicApplicationSubmit);

  document.querySelectorAll('[data-login-method]').forEach((button) => {
    button.addEventListener('click', () => authWithRobloxOrDiscord(button.dataset.loginMethod));
  });
}

function setSession(email, isOwner) {
  localStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify({ email, isOwner, loggedInAt: new Date().toISOString() })
  );
}

function handleStaffLogin(event) {
  event.preventDefault();

  const email = document.getElementById('staffEmail').value.trim();
  const password = document.getElementById('staffPassword').value;

  const normalizedEmail = email.toLowerCase();
  const users = getStaffAccounts();
  const ownerMatch = normalizedEmail === OWNER_EMAIL.toLowerCase() && password === OWNER_PASSWORD;
  const staffMatch = users.some((user) => user.email.toLowerCase() === normalizedEmail && user.password === password);

  if (ownerMatch || staffMatch) {
    setSession(normalizedEmail, ownerMatch);
    window.location.href = 'staff-panel.html';
    return;
  }

  alert('Invalid staff credentials. Please try again.');
}

function setupStaffLogin() {
  const form = document.getElementById('staff-login-form');
  if (!form) return;

  form.addEventListener('submit', handleStaffLogin);
}

function checkStaffAccess() {
  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  if (!session) {
    window.location.href = 'staff-login.html';
    return false;
  }

  return true;
}

function renderNotifications() {
  const list = document.getElementById('notification-list');
  if (!list) return;

  const notifications = getNotifications();
  if (!notifications.length) {
    list.innerHTML = '<div class="notification-item">No notifications yet.</div>';
    return;
  }

  list.innerHTML = notifications
    .map(
      (notification) => `
        <div class="notification-item">
          <strong>${escapeHtml(new Date(notification.createdAt).toLocaleString())}</strong><br />
          ${escapeHtml(notification.message)}
        </div>
      `
    )
    .join('');
}

function renderApplicationDetails(applicationId) {
  const container = document.getElementById('application-details');
  if (!container) return;

  const applications = getApplications();
  const application = applications.find((entry) => entry.id === applicationId);

  if (!application) {
    container.innerHTML = 'Select an application to review it.';
    return;
  }

  const statusClass = application.status.toLowerCase();
  container.innerHTML = `
    <div class="application-detail-card">
      <h3>${escapeHtml(application.fullName)}</h3>
      <div class="status-badge ${statusClass}">${escapeHtml(application.status)}</div>
      <div class="application-detail-grid">
        <div class="application-detail-field">
          <strong>Roblox</strong>
          <span>${escapeHtml(application.robloxUser)}</span>
        </div>
        <div class="application-detail-field">
          <strong>Discord</strong>
          <span>${escapeHtml(application.discordUser || 'Not provided')}</span>
        </div>
        <div class="application-detail-field">
          <strong>Preferred role</strong>
          <span>${escapeHtml(application.preferredRole)}</span>
        </div>
        <div class="application-detail-field">
          <strong>Availability</strong>
          <span>${escapeHtml(application.availability)}</span>
        </div>
        <div class="application-detail-field" style="grid-column: 1 / -1;">
          <strong>Why they want to join</strong>
          <span>${escapeHtml(application.experience)}</span>
        </div>
      </div>
      <div class="application-detail-actions">
        <button class="primary-btn" type="button" data-approve-app="${escapeHtml(application.id)}">Approve</button>
        <button class="secondary-btn" type="button" data-deny-app="${escapeHtml(application.id)}">Deny</button>
      </div>
    </div>
  `;

  container.querySelector('[data-approve-app]')?.addEventListener('click', () => {
    setApplicationStatus(application.id, 'Approved');
  });

  container.querySelector('[data-deny-app]')?.addEventListener('click', () => {
    setApplicationStatus(application.id, 'Denied');
  });
}

function renderApplicationTable() {
  const tableBody = document.getElementById('application-table-body');
  if (!tableBody) return;

  const applications = getApplications();
  if (!applications.length) {
    tableBody.innerHTML = '<div class="application-role-card"><div class="application-role-card-main"><h3>No applications submitted yet</h3><p>Applications will appear here when they are submitted.</p></div></div>';
    return;
  }

  tableBody.innerHTML = applications
    .map(
      (application) => `
        <div class="application-role-card">
          <div class="application-role-card-main">
            <h3>${escapeHtml(application.fullName)}</h3>
            <div class="application-role-card-footer">
              <span class="status-badge ${application.status.toLowerCase()}">${escapeHtml(application.status)}</span>
              <span>${escapeHtml(application.preferredRole)}</span>
            </div>
            <p>
              ${escapeHtml(application.robloxUser)} • ${escapeHtml(application.availability)} • Submitted ${escapeHtml(new Date(application.submittedAt).toLocaleDateString())}
            </p>
          </div>
          <button class="review-btn" type="button" data-view-app="${escapeHtml(application.id)}">Review</button>
        </div>
      `
    )
    .join('');

  tableBody.querySelectorAll('[data-view-app]').forEach((button) => {
    button.addEventListener('click', () => {
      renderApplicationDetails(button.dataset.viewApp);
    });
  });
}

function setApplicationStatus(applicationId, status) {
  const applications = getApplications();
  const match = applications.find((application) => application.id === applicationId);
  if (!match) return;

  match.status = status;
  localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(applications));
  createNotification(`Application for ${match.fullName} is now ${status}.`);
  renderApplicationTable();
  renderApplicationDetails(applicationId);
  renderNotifications();
}

function renderStaffTable() {
  const tableBody = document.getElementById('staff-table-body');
  if (!tableBody) return;

  const accounts = getStaffAccounts();
  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  const isOwner = session && session.isOwner;

  if (!isOwner) {
    tableBody.innerHTML = '<tr><td colspan="3">Only the owner can manage staff accounts.</td></tr>';
    const form = document.getElementById('staff-create-form');
    if (form) form.style.display = 'none';
    return;
  }

  tableBody.innerHTML = accounts
    .map(
      (account) => `
        <tr>
          <td>${escapeHtml(account.email)}</td>
          <td>${escapeHtml(account.role)}</td>
          <td class="action-cell">
            <button class="action-btn" type="button" data-edit-email="${escapeHtml(account.email)}">Edit</button>
            <button class="action-btn delete" type="button" data-remove-email="${escapeHtml(account.email)}">Remove</button>
          </td>
        </tr>`
    )
    .join('');

  tableBody.querySelectorAll('[data-edit-email]').forEach((button) => {
    button.addEventListener('click', () => {
      const email = button.dataset.editEmail;
      const staff = getStaffAccounts();
      const target = staff.find((person) => person.email.toLowerCase() === email.toLowerCase());
      if (!target) return;

      const newEmail = safePrompt('Update email address for this staff member:', target.email);
      if (newEmail === null) return;

      const newPassword = safePrompt('Enter a new password for this staff member (leave blank to keep the current one):', '');
      const cleanEmail = newEmail.trim();
      const emailToUse = cleanEmail || target.email;
      const passwordToUse = newPassword && newPassword.trim() ? newPassword.trim() : target.password;

      const duplicate = staff.some(
        (person) => person.email.toLowerCase() === emailToUse.toLowerCase() && person.email.toLowerCase() !== email.toLowerCase()
      );

      if (duplicate) {
        alert('That email is already assigned to another staff member.');
        return;
      }

      target.email = emailToUse;
      target.password = passwordToUse;
      localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff));
      renderStaffTable();
      alert(`Staff account updated for ${emailToUse}.`);
    });
  });

  tableBody.querySelectorAll('[data-remove-email]').forEach((button) => {
    button.addEventListener('click', () => {
      const email = button.dataset.removeEmail;
      const confirmed = window.confirm(`Remove ${email} from staff access?`);
      if (!confirmed) return;

      const staff = getStaffAccounts().filter((person) => person.email.toLowerCase() !== email.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff));
      renderStaffTable();
      alert(`${email} was removed.`);
    });
  });
}

function createStaffAccount(event) {
  event.preventDefault();

  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  if (!session || !session.isOwner) {
    alert('Only the owner can create staff accounts.');
    return;
  }

  const email = document.getElementById('newStaffEmail').value.trim();
  const password = document.getElementById('newStaffPassword').value;
  const role = document.getElementById('newStaffRole').value;

  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }

  const staff = getStaffAccounts();
  const duplicate = staff.some((person) => person.email.toLowerCase() === email.toLowerCase());
  if (duplicate) {
    alert('That staff email already exists.');
    return;
  }

  staff.push({ email, password, role });
  localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff));
  document.getElementById('staff-create-form').reset();
  renderStaffTable();
  alert(`${email} was added as a staff member.`);
}

function setupStaffPanel() {
  const form = document.getElementById('staff-create-form');
  const openBtn = document.getElementById('open-applications-btn');
  const closeBtn = document.getElementById('close-applications-btn');
  const statusPill = document.getElementById('applications-status-pill');
  if (!form) return;

  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  if (!session) {
    window.location.href = 'staff-login.html';
    return;
  }

  updateUserBadge();
  renderStaffTable();
  renderApplicationTable();
  renderApplicationDetails(getApplications()[0]?.id || '');
  renderNotifications();

  if (statusPill) {
    const isOpen = getApplicationsOpenState();
    statusPill.textContent = isOpen ? 'Open' : 'Closed';
    statusPill.classList.toggle('open', isOpen);
    statusPill.classList.toggle('closed', !isOpen);
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      setApplicationsOpenState(true);
      if (statusPill) {
        statusPill.textContent = 'Open';
        statusPill.classList.add('open');
        statusPill.classList.remove('closed');
      }
      createNotification('Applications opened by staff.');
      renderNotifications();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      setApplicationsOpenState(false);
      if (statusPill) {
        statusPill.textContent = 'Closed';
        statusPill.classList.add('closed');
        statusPill.classList.remove('open');
      }
      createNotification('Applications closed by staff.');
      renderNotifications();
    });
  }

  if (form) form.addEventListener('submit', createStaffAccount);

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    window.location.href = 'staff-login.html';
  });
}

function initPage() {
  ensureDefaultStaffAccounts();
  applyInitialTheme();
  setupPublicNavigation();
  setupThemeControls();
  setupSettingsForm();

  if (document.body.dataset.page === 'applications') {
    completeDiscordLoginFromCallback();
  }

  setupApplications();
  setupStaffLogin();

  if (document.body.dataset.page === 'staff-panel') {
    if (!checkStaffAccess()) {
      return;
    }
    setupStaffPanel();
  }
}

document.addEventListener('DOMContentLoaded', initPage);
