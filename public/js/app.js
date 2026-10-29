// public/js/app.js
// Shared helpers used by EVERY page: API calls, login session, navbar, toasts, dialogs.
// This file must be loaded first (before auth.js and products.js).

const API_BASE = '/api';

// Change these two values to show prices in another currency
const CURRENCY = { locale: 'en-IN', code: 'INR' };

// Where we keep the login information in the browser
const TOKEN_KEY = 'pc_token';
const USER_KEY = 'pc_user';

/* ---------- Tiny DOM helpers ---------- */
const $ = (selector, root = document) => root.querySelector(selector);

/* ---------- Session (who is logged in?) ---------- */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (error) {
    return null;
  }
}

function isLoggedIn() {
  return Boolean(getToken());
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ---------- Talking to the backend ---------- */
class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

// apiRequest('/products?page=1')                                  -> GET
// apiRequest('/products', { method: 'POST', body: {...}, auth: true }) -> POST with the JWT token
async function apiRequest(path, options = {}) {
  const { method = 'GET', body, auth = false } = options;
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError('Cannot reach the server. Please check that it is running.', 0);
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    // the response had no JSON body; keep the empty object
  }

  if (!response.ok) {
    // An expired or invalid token means the user must log in again
    if (response.status === 401 && auth) clearSession();
    throw new ApiError(data.message || 'Something went wrong', response.status, data.errors);
  }

  return data;
}

/* ---------- Formatting ---------- */
// Escape text before putting it into innerHTML. This prevents XSS attacks.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(amount) {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatNumber(number) {
  return new Intl.NumberFormat(CURRENCY.locale).format(number || 0);
}

function formatDate(isoDate) {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Returns { text, className } describing the stock level
function stockInfo(stock) {
  if (stock <= 0) return { text: 'Out of stock', className: 'badge-danger' };
  if (stock <= 5) return { text: `Only ${stock} left`, className: 'badge-warning' };
  return { text: `In stock (${stock})`, className: 'badge-success' };
}

// A simple grey picture used when a product has no image or the image fails to load
function placeholderImage(label) {
  const letter = escapeHtml((label || '?').charAt(0).toUpperCase());
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
    '<rect width="100%" height="100%" fill="#e5e7eb"/>' +
    '<text x="50%" y="52%" font-family="Arial" font-size="120" fill="#9ca3af" ' +
    `text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Put the right picture in an <img>, with a fallback if the URL is broken
function setProductImage(imgElement, imageUrl, productName) {
  imgElement.alt = productName ? `Photo of ${productName}` : 'Product image';
  imgElement.addEventListener('error', () => {
    imgElement.src = placeholderImage(productName);
  }, { once: true });
  imgElement.src = imageUrl || placeholderImage(productName);
}

function debounce(callback, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ---------- Messages: toast, alert, spinner, confirm dialog ---------- */
function showToast(message, type = 'success') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// Show one or more error messages inside an alert box
function showAlert(element, message, details = []) {
  element.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = message;
  element.appendChild(title);

  if (details.length) {
    const list = document.createElement('ul');
    details.forEach((detail) => {
      const item = document.createElement('li');
      item.textContent = detail;
      list.appendChild(item);
    });
    element.appendChild(list);
  }
  element.hidden = false;
}

function hideAlert(element) {
  element.hidden = true;
  element.innerHTML = '';
}

function spinnerHtml(text = 'Loading...') {
  return `<div class="loading-box" role="status"><div class="spinner"></div><span>${escapeHtml(text)}</span></div>`;
}

// Disable a button and change its text while we wait for the server
function setButtonLoading(button, isLoading, loadingText = 'Please wait...') {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

// Shows a confirmation popup. Returns a Promise: true = confirmed, false = cancelled.
function confirmDialog(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <h2>Are you sure?</h2>
        <p class="dialog-message"></p>
        <div class="dialog-actions">
          <button type="submit" value="cancel" class="btn btn-outline">Cancel</button>
          <button type="submit" value="confirm" class="btn btn-danger dialog-confirm"></button>
        </div>
      </form>`;
    $('.dialog-message', dialog).textContent = message;
    $('.dialog-confirm', dialog).textContent = confirmLabel;

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

// If a request fails with 401 (not logged in), send the user to the login page.
// Otherwise show the error message in the given alert box.
function handleApiError(error, alertElement) {
  if (error.status === 401) {
    showToast('Please log in to continue.', 'error');
    const here = window.location.pathname.split('/').pop() + window.location.search;
    setTimeout(() => { window.location.href = `login.html?redirect=${encodeURIComponent(here)}`; }, 800);
    return;
  }
  if (alertElement) showAlert(alertElement, error.message, error.errors);
  else showToast(error.message, 'error');
}

/* ---------- Navbar (built by JavaScript so every page shares it) ---------- */
function renderNavbar() {
  const header = $('#site-header');
  if (!header) return;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const loggedIn = isLoggedIn();
  const user = getUser();

  const navLink = (href, label) =>
    `<a href="${href}"${currentPage === href ? ' aria-current="page"' : ''}>${label}</a>`;

  header.innerHTML = `
    <div class="container nav-inner">
      <a class="brand" href="index.html" aria-label="CatalogHub home">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>
        </svg>
        <span>Catalog<strong>Hub</strong></span>
      </a>
      <button class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="Toggle menu">&#9776;</button>
      <nav id="nav-menu" class="nav-menu" aria-label="Main navigation">
        ${navLink('index.html', 'Catalog')}
        ${navLink('dashboard.html', 'Dashboard')}
        ${loggedIn ? navLink('add-product.html', 'Add Product') : ''}
        <span class="nav-spacer"></span>
        ${
          loggedIn
            ? `<span class="nav-user">Hi, ${escapeHtml(user && user.name ? user.name : 'there')}</span>
               <button type="button" class="btn btn-outline btn-sm" id="logout-btn">Log out</button>`
            : `${navLink('login.html', 'Login')}
               <a class="btn btn-primary btn-sm" href="register.html">Register</a>`
        }
      </nav>
    </div>`;

  // Open/close the menu on small screens
  const toggle = $('#nav-toggle');
  const menu = $('#nav-menu');
  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  const logoutButton = $('#logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      clearSession();
      showToast('You have been logged out.');
      setTimeout(() => { window.location.href = 'index.html'; }, 600);
    });
  }
}

// If we have a token, quietly check that it is still valid.
// If the server says no (expired), log the user out in the navbar.
async function verifySession() {
  if (!isLoggedIn()) return;
  try {
    await apiRequest('/auth/me', { auth: true });
  } catch (error) {
    if (error.status === 401) renderNavbar(); // session was cleared, redraw the navbar
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  verifySession();

  const year = $('#footer-year');
  if (year) year.textContent = new Date().getFullYear();
});
