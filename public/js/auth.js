// public/js/auth.js
// Login and registration forms, plus a helper to protect pages.
// Needs app.js to be loaded first.

// Only allow redirecting to our own pages (stops "open redirect" tricks).
function getSafeRedirect() {
  const target = getQueryParam('redirect');
  return target && /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(target) ? target : 'index.html';
}

// Call this at the top of pages that need a logged-in user.
// Returns true if the user is logged in, otherwise sends them to the login page.
function requireAuth() {
  if (isLoggedIn()) return true;
  const here = window.location.pathname.split('/').pop() + window.location.search;
  window.location.replace(`login.html?redirect=${encodeURIComponent(here)}`);
  return false;
}

function initLoginForm() {
  const form = $('#login-form');
  const alertBox = $('#form-alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);
    const button = $('button[type="submit"]', form);
    setButtonLoading(button, true, 'Logging in...');

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: form.email.value, password: form.password.value },
      });
      saveSession(data.token, data.user);
      showToast(`Welcome back, ${data.user.name}!`);
      setTimeout(() => { window.location.href = getSafeRedirect(); }, 700);
    } catch (error) {
      showAlert(alertBox, error.message, error.errors);
      setButtonLoading(button, false);
    }
  });
}

function initRegisterForm() {
  const form = $('#register-form');
  const alertBox = $('#form-alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);

    if (form.password.value !== form.confirmPassword.value) {
      showAlert(alertBox, 'Passwords do not match');
      return;
    }

    const button = $('button[type="submit"]', form);
    setButtonLoading(button, true, 'Creating account...');

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: form.elements.name.value, email: form.email.value, password: form.password.value },
      });
      saveSession(data.token, data.user); // registering also logs you in
      showToast('Account created. Welcome!');
      setTimeout(() => { window.location.href = getSafeRedirect(); }, 700);
    } catch (error) {
      showAlert(alertBox, error.message, error.errors);
      setButtonLoading(button, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'login' || page === 'register') {
    // Already logged in? No need to see these pages.
    if (isLoggedIn()) {
      window.location.replace('index.html');
      return;
    }
    if (page === 'login') initLoginForm();
    else initRegisterForm();
  }
});
