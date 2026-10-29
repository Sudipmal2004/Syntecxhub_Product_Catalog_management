// public/js/products.js
// Everything about products on the frontend:
// catalog (search, filters, pagination), details, add, edit, and the dashboard.
// Needs app.js and auth.js to be loaded first.

/* =========================================================
   Shared helpers
   ========================================================= */

// Builds one product card (used on the catalog page)
function createProductCard(product) {
  const article = document.createElement('article');
  article.className = 'product-card';
  const stock = stockInfo(product.stock);

  article.innerHTML = `
    <img loading="lazy" width="600" height="400" alt="">
    <div class="product-card-body">
      <span class="badge">${escapeHtml(product.category)}</span>
      <h3><a href="product-details.html?id=${encodeURIComponent(product._id)}">${escapeHtml(product.name)}</a></h3>
      <span class="product-brand">${escapeHtml(product.brand)}</span>
      <span class="badge ${stock.className}">${escapeHtml(stock.text)}</span>
      <span class="product-price">${formatPrice(product.price)}</span>
    </div>`;

  setProductImage($('img', article), product.imageUrl, product.name);
  return article;
}

// A friendly message box with an optional button
function messageBoxHtml(title, text, buttonHtml = '') {
  return `<div class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>${buttonHtml}</div>`;
}

// Fill the <datalist> suggestions (category and brand) on the Add/Edit forms
async function fillFormSuggestions() {
  try {
    const { data } = await apiRequest('/products/meta/filters');
    const fill = (selector, values) => {
      const list = $(selector);
      if (!list) return;
      list.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
    };
    fill('#category-list', data.categories);
    fill('#brand-list', data.brands);
  } catch (error) {
    // Suggestions are optional, so we ignore errors here
  }
}

// Read the values from the product form
function readProductForm(form) {
  return {
    name: form.elements.name.value,
    description: form.description.value,
    price: form.price.value,
    category: form.category.value,
    brand: form.brand.value,
    stock: form.stock.value,
    imageUrl: form.imageUrl.value,
  };
}

// Show a live picture preview when the user types an image URL
function setupImagePreview(form) {
  const preview = $('#image-preview');
  if (!preview) return;
  const update = () => setProductImage(preview, form.imageUrl.value.trim(), form.elements.name.value || 'Product');
  form.imageUrl.addEventListener('input', debounce(update, 300));
  update();
}

/* =========================================================
   Catalog page (index.html)
   ========================================================= */
function initCatalog() {
  // "state" remembers everything the user picked. It is sent to the backend as query parameters.
  const state = {
    page: 1,
    limit: 8,
    search: getQueryParam('search') || '',
    category: getQueryParam('category') || '',
    brand: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'createdAt',
    order: 'desc',
  };

  const form = $('#filter-form');
  const grid = $('#product-grid');
  const info = $('#results-info');
  const pagination = $('#pagination');
  let latestRequest = 0; // lets us ignore old responses if the user types quickly

  // Put the starting values into the form
  form.search.value = state.search;

  const hasActiveFilters = () =>
    Boolean(state.search || state.category || state.brand || state.minPrice || state.maxPrice);

  async function loadProducts() {
    const thisRequest = ++latestRequest;
    grid.innerHTML = spinnerHtml('Loading products...');
    pagination.hidden = true;

    // Turn the state into ?page=1&limit=8&search=... (skip empty values)
    const params = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
      if (value !== '') params.set(key, value);
    });

    try {
      const result = await apiRequest(`/products?${params.toString()}`);
      if (thisRequest !== latestRequest) return; // a newer request replaced this one

      const { totalPages, totalProducts } = result.pagination;

      // The page number may be too high after filtering. Go to the last page instead.
      if (result.data.length === 0 && totalProducts > 0 && state.page > totalPages) {
        state.page = totalPages;
        loadProducts();
        return;
      }

      renderProducts(result);
    } catch (error) {
      if (thisRequest !== latestRequest) return;
      info.textContent = '';
      grid.innerHTML = messageBoxHtml(
        'Could not load products',
        error.message,
        '<button type="button" class="btn btn-primary" id="retry-btn">Try again</button>'
      );
      $('#retry-btn').addEventListener('click', loadProducts);
    }
  }

  function renderProducts(result) {
    const { page, limit, totalProducts, totalPages, hasPrevPage, hasNextPage } = result.pagination;

    // Nothing found
    if (result.data.length === 0) {
      info.textContent = '';
      grid.innerHTML = hasActiveFilters()
        ? messageBoxHtml(
            'No products found',
            'We could not find any products that match your search or filters. Try different words or clear the filters.',
            '<button type="button" class="btn btn-primary" id="clear-from-empty">Clear all filters</button>'
          )
        : messageBoxHtml('The catalog is empty', 'There are no products yet. Log in and add the first one!');
      const clearButton = $('#clear-from-empty');
      if (clearButton) clearButton.addEventListener('click', resetFilters);
      return;
    }

    // Results text: "Showing 1-8 of 24 products"
    const from = (page - 1) * limit + 1;
    const to = from + result.data.length - 1;
    info.textContent = `Showing ${from}-${to} of ${totalProducts} product${totalProducts === 1 ? '' : 's'}`;

    // Product cards
    const list = document.createElement('div');
    list.className = 'product-grid';
    result.data.forEach((product) => list.appendChild(createProductCard(product)));
    grid.innerHTML = '';
    grid.appendChild(list);

    // Pagination buttons
    pagination.innerHTML = `
      <button type="button" class="btn btn-outline" id="prev-page" ${hasPrevPage ? '' : 'disabled'}>&larr; Previous</button>
      <span class="pagination-status" aria-live="polite">Page ${page} of ${totalPages}</span>
      <button type="button" class="btn btn-outline" id="next-page" ${hasNextPage ? '' : 'disabled'}>Next &rarr;</button>`;
    pagination.hidden = false;

    $('#prev-page').addEventListener('click', () => goToPage(state.page - 1));
    $('#next-page').addEventListener('click', () => goToPage(state.page + 1));
  }

  function goToPage(pageNumber) {
    state.page = pageNumber;
    loadProducts();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Whenever a filter changes we go back to page 1
  function applyFilters() {
    state.search = form.search.value.trim();
    state.category = form.category.value;
    state.brand = form.brand.value;
    state.minPrice = form.minPrice.value;
    state.maxPrice = form.maxPrice.value;
    state.limit = Number(form.limit.value);
    const [sortBy, order] = form.sort.value.split(':');
    state.sortBy = sortBy;
    state.order = order;
    state.page = 1;
    loadProducts();
  }

  function resetFilters() {
    form.reset();
    applyFilters();
  }

  // Fill the category and brand dropdowns from the database
  async function loadFilterOptions() {
    try {
      const { data } = await apiRequest('/products/meta/filters');
      const fill = (select, values, current) => {
        values.forEach((value) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });
        select.value = current;
      };
      fill(form.category, data.categories, state.category);
      fill(form.brand, data.brands, state.brand);
    } catch (error) {
      // The dropdowns just stay empty if this fails
    }
  }

  // Wire up the controls
  const debouncedApply = debounce(applyFilters, 400);
  form.search.addEventListener('input', debouncedApply);
  form.minPrice.addEventListener('input', debouncedApply);
  form.maxPrice.addEventListener('input', debouncedApply);
  [form.category, form.brand, form.sort, form.limit].forEach((control) =>
    control.addEventListener('change', applyFilters)
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });
  $('#reset-filters').addEventListener('click', resetFilters);

  loadFilterOptions();
  loadProducts();
}

/* =========================================================
   Product details page (product-details.html)
   ========================================================= */
async function initProductDetails() {
  const container = $('#product-details');
  const id = getQueryParam('id');

  if (!id) {
    container.innerHTML = messageBoxHtml('No product selected', 'Please choose a product from the catalog.',
      '<a class="btn btn-primary" href="index.html">Back to catalog</a>');
    return;
  }

  container.innerHTML = spinnerHtml('Loading product...');

  try {
    const { data: product } = await apiRequest(`/products/${encodeURIComponent(id)}`);
    document.title = `${product.name} - CatalogHub`;
    const stock = stockInfo(product.stock);

    container.innerHTML = `
      <div class="panel details">
        <img alt="">
        <div>
          <span class="badge">${escapeHtml(product.category)}</span>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="price">${formatPrice(product.price)}</p>
          <span class="badge ${stock.className}">${escapeHtml(stock.text)}</span>
          <p style="margin-top:1rem">${escapeHtml(product.description)}</p>
          <dl class="meta-list">
            <dt>Brand</dt><dd>${escapeHtml(product.brand)}</dd>
            <dt>Category</dt><dd>${escapeHtml(product.category)}</dd>
            <dt>Stock</dt><dd>${escapeHtml(product.stock)} units</dd>
            <dt>Added on</dt><dd>${formatDate(product.createdAt)}</dd>
            <dt>Last updated</dt><dd>${formatDate(product.updatedAt)}</dd>
          </dl>
          <div class="details-actions" id="detail-actions"></div>
        </div>
      </div>`;

    setProductImage($('img', container), product.imageUrl, product.name);

    const actions = $('#detail-actions');
    if (isLoggedIn()) {
      actions.innerHTML = `
        <a class="btn btn-primary" href="edit-product.html?id=${encodeURIComponent(product._id)}">Edit product</a>
        <button type="button" class="btn btn-danger" id="delete-btn">Delete product</button>
        <a class="btn btn-outline" href="index.html">Back to catalog</a>`;

      $('#delete-btn').addEventListener('click', async (event) => {
        const confirmed = await confirmDialog(`Delete "${product.name}"? This cannot be undone.`);
        if (!confirmed) return;

        const button = event.currentTarget;
        setButtonLoading(button, true, 'Deleting...');
        try {
          await apiRequest(`/products/${encodeURIComponent(product._id)}`, { method: 'DELETE', auth: true });
          showToast('Product deleted successfully.');
          setTimeout(() => { window.location.href = 'index.html'; }, 800);
        } catch (error) {
          setButtonLoading(button, false);
          handleApiError(error);
        }
      });
    } else {
      actions.innerHTML = `
        <a class="btn btn-outline" href="index.html">Back to catalog</a>
        <a class="btn btn-primary" href="login.html?redirect=${encodeURIComponent(`product-details.html?id=${product._id}`)}">Log in to edit</a>`;
    }
  } catch (error) {
    container.innerHTML = messageBoxHtml(
      error.status === 404 ? 'Product not found' : 'Could not load product',
      error.status === 404 ? 'This product may have been deleted.' : error.message,
      '<a class="btn btn-primary" href="index.html">Back to catalog</a>'
    );
  }
}

/* =========================================================
   Add product page (add-product.html)
   ========================================================= */
function initAddProduct() {
  if (!requireAuth()) return;

  const form = $('#product-form');
  const alertBox = $('#form-alert');
  const button = $('button[type="submit"]', form);

  fillFormSuggestions();
  setupImagePreview(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);
    setButtonLoading(button, true, 'Saving...');

    try {
      const { data } = await apiRequest('/products', {
        method: 'POST',
        body: readProductForm(form),
        auth: true,
      });
      showToast('Product created successfully.');
      setTimeout(() => { window.location.href = `product-details.html?id=${encodeURIComponent(data._id)}`; }, 800);
    } catch (error) {
      setButtonLoading(button, false);
      handleApiError(error, alertBox);
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

/* =========================================================
   Edit product page (edit-product.html)
   ========================================================= */
async function initEditProduct() {
  if (!requireAuth()) return;

  const id = getQueryParam('id');
  const loading = $('#edit-loading');
  const form = $('#product-form');
  const alertBox = $('#form-alert');
  const button = $('button[type="submit"]', form);

  if (!id) {
    loading.innerHTML = messageBoxHtml('No product selected', 'Please choose a product to edit.',
      '<a class="btn btn-primary" href="index.html">Back to catalog</a>');
    return;
  }

  fillFormSuggestions();

  // Load the current values into the form
  try {
    const { data: product } = await apiRequest(`/products/${encodeURIComponent(id)}`);
    form.elements.name.value = product.name;
    form.description.value = product.description;
    form.price.value = product.price;
    form.category.value = product.category;
    form.brand.value = product.brand;
    form.stock.value = product.stock;
    form.imageUrl.value = product.imageUrl || '';
    $('#cancel-link').href = `product-details.html?id=${encodeURIComponent(product._id)}`;

    loading.hidden = true;
    form.hidden = false;
    setupImagePreview(form);
  } catch (error) {
    loading.innerHTML = messageBoxHtml(
      error.status === 404 ? 'Product not found' : 'Could not load product',
      error.message,
      '<a class="btn btn-primary" href="index.html">Back to catalog</a>'
    );
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);
    setButtonLoading(button, true, 'Saving...');

    try {
      await apiRequest(`/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: readProductForm(form),
        auth: true,
      });
      showToast('Product updated successfully.');
      setTimeout(() => { window.location.href = `product-details.html?id=${encodeURIComponent(id)}`; }, 800);
    } catch (error) {
      setButtonLoading(button, false);
      handleApiError(error, alertBox);
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

/* =========================================================
   Dashboard page (dashboard.html)
   ========================================================= */
async function initDashboard() {
  const alertBox = $('#dashboard-alert');
  const summaryBox = $('#summary-stats');
  const content = $('#dashboard-content');

  summaryBox.innerHTML = spinnerHtml('Loading statistics...');

  try {
    // Ask for both statistics at the same time
    const [summaryResult, categoryResult] = await Promise.all([
      apiRequest('/products/stats/summary'),
      apiRequest('/products/stats/categories'),
    ]);

    renderSummaryCards(summaryResult.data, summaryBox);

    if (summaryResult.data.totalProducts === 0) {
      content.hidden = true;
      return;
    }

    renderCategoryStats(categoryResult.data);
    content.hidden = false;
  } catch (error) {
    summaryBox.innerHTML = '';
    showAlert(alertBox, error.message, error.errors);
  }
}

function renderSummaryCards(summary, box) {
  if (summary.totalProducts === 0) {
    box.innerHTML = messageBoxHtml('No statistics yet', 'Add some products and the numbers will appear here.',
      '<a class="btn btn-primary" href="add-product.html">Add a product</a>');
    return;
  }

  const productLink = (product) =>
    `<a href="product-details.html?id=${encodeURIComponent(product._id)}">${escapeHtml(product.name)}</a>`;

  box.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total products</div><div class="stat-value">${formatNumber(summary.totalProducts)}</div></div>
      <div class="stat-card"><div class="stat-label">Total stock</div><div class="stat-value">${formatNumber(summary.totalStock)}</div><div class="stat-sub">units in inventory</div></div>
      <div class="stat-card"><div class="stat-label">Average price</div><div class="stat-value">${formatPrice(summary.averagePrice)}</div></div>
      <div class="stat-card"><div class="stat-label">Inventory value</div><div class="stat-value">${formatPrice(summary.inventoryValue)}</div><div class="stat-sub">price &times; stock</div></div>
      <div class="stat-card"><div class="stat-label">Highest priced</div><div class="stat-value">${formatPrice(summary.highestPriced.price)}</div><div class="stat-sub">${productLink(summary.highestPriced)}</div></div>
      <div class="stat-card"><div class="stat-label">Lowest priced</div><div class="stat-value">${formatPrice(summary.lowestPriced.price)}</div><div class="stat-sub">${productLink(summary.lowestPriced)}</div></div>
    </div>`;
}

function renderCategoryStats(categories) {
  const maxCount = Math.max(...categories.map((item) => item.productCount), 1);
  const maxAverage = Math.max(...categories.map((item) => item.averagePrice), 1);

  const barRow = (label, value, valueText, maxValue, extraClass = '') => `
    <div class="bar-row ${extraClass}">
      <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.max((value / maxValue) * 100, 2)}%"></div></div>
      <span class="bar-value">${valueText}</span>
    </div>`;

  $('#count-bars').innerHTML = categories
    .map((item) => barRow(item.category, item.productCount, formatNumber(item.productCount), maxCount))
    .join('');

  $('#price-bars').innerHTML = categories
    .map((item) => barRow(item.category, item.averagePrice, formatPrice(item.averagePrice), maxAverage, 'bar-row-wide'))
    .join('');

  $('#category-table-body').innerHTML = categories
    .map(
      (item) => `
      <tr>
        <td><a href="index.html?category=${encodeURIComponent(item.category)}">${escapeHtml(item.category)}</a></td>
        <td class="num">${formatNumber(item.productCount)}</td>
        <td class="num">${formatPrice(item.averagePrice)}</td>
        <td class="num">${formatPrice(item.minPrice)}</td>
        <td class="num">${formatPrice(item.maxPrice)}</td>
        <td class="num">${formatNumber(item.totalStock)}</td>
      </tr>`
    )
    .join('');
}

/* =========================================================
   Start the right code for the current page
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  switch (document.body.dataset.page) {
    case 'catalog': initCatalog(); break;
    case 'details': initProductDetails(); break;
    case 'add': initAddProduct(); break;
    case 'edit': initEditProduct(); break;
    case 'dashboard': initDashboard(); break;
    default: break; // login/register pages are handled in auth.js
  }
});
