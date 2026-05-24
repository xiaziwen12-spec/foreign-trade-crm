// ============================================
// products.js - 产品&报价管理模块
// ============================================

const Products = {
  currentFilter: { category: '', search: '' },

  render(project) {
    const products = DB.getProducts(project);
    const filtered = this._filter(products);
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    return `
      <div class="page-products">
        <div class="page-header">
          <h2 class="page-title">🏷️ 产品目录 · ${projName}项目</h2>
          <button class="btn btn-primary" onclick="Products.showAddForm('${project}')">➕ 新增产品</button>
        </div>

        <!-- 筛选栏 -->
        <div class="filter-bar">
          <input type="text" id="product-search" class="search-input"
            placeholder="🔍 搜索产品名、型号..." value="${this.currentFilter.search}"
            oninput="Products.currentFilter.search=this.value; App.render()">
          <select id="product-category-filter" onchange="Products.currentFilter.category=this.value; App.render()">
            <option value="">全部分类</option>
            ${categories.map(c => `<option value="${c}" ${this.currentFilter.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <span class="result-count">${filtered.length} 个产品 / 共 ${products.length} 个</span>
        </div>

        <!-- 价格换算工具 -->
        <div class="price-converter">
          <h4>💱 价格换算 (CNY ↔ USD)  · 公式: ÷0.6÷6.7</h4>
          <div class="converter-row">
            <div class="converter-item">
              <label>CNY → USD</label>
              <input type="number" id="conv-cny" placeholder="输入CNY价格" step="0.01"
                oninput="document.getElementById('conv-usd-result').textContent=Utils.cnyToUsd(this.value).toFixed(2)">
              <span class="conv-result">→ $<strong id="conv-usd-result">0.00</strong></span>
            </div>
            <div class="converter-divider">|</div>
            <div class="converter-item">
              <label>USD → CNY</label>
              <input type="number" id="conv-usd" placeholder="输入USD价格" step="0.01"
                oninput="document.getElementById('conv-cny-result').textContent=Utils.usdToCny(this.value).toFixed(2)">
              <span class="conv-result">→ ¥<strong id="conv-cny-result">0.00</strong></span>
            </div>
          </div>
        </div>

        <!-- 产品列表 -->
        ${filtered.length > 0 ? `
          <div class="product-grid">
            ${filtered.map(p => {
              const profitRate = p.costCNY && p.priceCNY ? (((p.priceCNY - p.costCNY) / p.priceCNY * 100)).toFixed(1) : '-';
              return `
                <div class="product-card">
                  <div class="card-header">
                    <span class="card-category">${p.category || '未分类'}</span>
                    <span class="card-model">${p.model || ''}</span>
                  </div>
                  <h3 class="card-title">${p.name}</h3>
                  <p class="card-desc">${p.description || ''}</p>

                  <div class="card-price-row">
                    <div class="price-box price-cost">
                      <span class="price-label">成本</span>
                      <span class="price-value">¥${parseFloat(p.costCNY||0).toFixed(2)}</span>
                    </div>
                    <div class="price-arrow">→</div>
                    <div class="price-box price-sale">
                      <span class="price-label">售价(CNY)</span>
                      <span class="price-value">¥${parseFloat(p.priceCNY||0).toFixed(2)}</span>
                    </div>
                    <div class="price-arrow">→</div>
                    <div class="price-box price-usd">
                      <span class="price-label">售价(USD)</span>
                      <span class="price-value">$${parseFloat(p.priceUSD||Utils.cnyToUsd(p.priceCNY)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div class="card-meta">
                    <span>📦 起订量: <strong>${p.moq || '-'}</strong></span>
                    <span>📐 单位: ${p.unit || '个'}</span>
                    <span>📈 利润率: <strong style="color:${(profitRate!=='-'&&profitRate>=0)?'#10b981':'#ef4444'}">${profitRate==='-'? '-': profitRate+'%'}</strong></span>
                  </div>

                  <div class="card-actions">
                    <button class="btn-sm btn-link" onclick="Products.showDetail('${project}','${p.id}')">详情</button>
                    <button class="btn-sm btn-link" onclick="Products.showEditForm('${project}','${p.id}')">编辑</button>
                    <button class="btn-sm btn-success" onclick="Products.generateQuote('${project}','${p.id}')">报价单</button>
                    <button class="btn-sm btn-danger" onclick="Products.confirmDelete('${project}','${p.id}','${p.name.replace(/'/g,"\\'")}')">删除</button>
                  </div>
                </div>`;
            }).join('')}
          </div>
        ` : '<p class="empty-text">暂无产品数据，点击上方按钮添加第一个产品 📦</p>'}
      </div>
    `;
  },

  _filter(products) {
    return products.filter(p => {
      if (this.currentFilter.category && p.category !== this.currentFilter.category) return false;
      if (this.currentFilter.search) {
        const q = this.currentFilter.search.toLowerCase();
        const fields = [p.name, p.model, p.description, p.category].join(' ').toLowerCase();
        if (!fields.includes(q)) return false;
      }
      return true;
    });
  },

  showAddForm(project) {
    const body = this._formHTML(null);
    const footer = `<button class="btn btn-primary" onclick="Products.saveProduct('${project}',null)">保存产品</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('➕ 新增产品', body, footer);
  },

  showEditForm(project, id) {
    const product = DB.findProduct(project, id);
    if (!product) { Utils.showToast('产品不存在', 'error'); return; }
    const body = this._formHTML(product);
    const footer = `<button class="btn btn-primary" onclick="Products.saveProduct('${project}','${id}')">保存修改</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('✏️ 编辑产品', body, footer);

    setTimeout(() => {
      Object.keys(product).forEach(key => {
        const el = document.getElementById(`prod-${key}`);
        if (el && product[key] !== undefined && product[key] !== null) el.value = product[key];
      });
    }, 50);
  },

  _formHTML(data) {
    return `
      <form id="product-form" onsubmit="return false;">
        <div class="form-grid">
          <div class="form-group"><label for="prod-name">产品名称 *</label><input type="text" id="prod-name" required placeholder="如：304不锈钢保温杯"></div>
          <div class="form-group"><label for="prod-model">型号</label><input type="text" id="prod-model" placeholder="如：TM-VAC-500"></div>
          
          <div class="form-group"><label for="prod-category">分类</label><input type="text" id="prod-category" placeholder="如：保温杯 / 马黛茶杯"></div>
          <div class="form-group"><label for="prod-unit">单位</label>
            <select id="prod-unit">
              <option value="个">个</option><option value="只">只</option><option value="套">套</option>
              <option value="件">件</option><option value="箱">箱</option><option value="kg">kg</option>
            </select>
          </div>
          
          <div class="form-group"><label for="prod-costCNY">成本价 (CNY)</label>
            <input type="number" id="prod-costCNY" placeholder="25.00" step="0.01" min="0"></div>
          <div class="form-group"><label for="prod-priceCNY">销售价 (CNY)</label>
            <input type="number" id="prod-priceCNY" placeholder="38.00" step="0.01" min="0"></div>
          <div class="form-group"><label for="prod-priceUSD">销售价 (USD)</label>
            <input type="number" id="prod-priceUSD" placeholder="自动换算或手动输入" step="0.01" min="0"></div>
          <div class="form-group"><label for="prod-moq">起订量(MOQ)</label>
            <input type="number" id="prod-moq" placeholder="500" min="1"></div>
          
          <div class="form-group full-width"><label for="prod-description">产品描述</label>
            <textarea id="prod-description" rows="3" placeholder="材质、规格、特点..."></textarea></div>
          
          <div class="form-group full-width" style="display:none;"><label for="prod-projectId">项目</label>
            <input type="text" id="prod-projectId" readonly></div>
        </div>

        <div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#666;">
            💡 填写CNY售价后可自动换算为USD（公式：÷0.6÷6.7），也可手动填写USD价格覆盖。
          </p>
          <button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;"
            onclick="const cny=document.getElementById('prod-priceCNY').value;if(cny){document.getElementById('prod-priceUSD').value=Utils.cnyToUsd(cny).toFixed(2);}else{Utils.showToast('先填CNY售价','warning')}">
            💱 自动换算 CNY → USD
          </button>
        </div>
      </form>
    `;
  },

  saveProduct(project, editId) {
    const fields = ['name', 'model', 'category', 'unit', 'costCNY', 'priceCNY',
      'priceUSD', 'moq', 'description', 'stock'];
    const data = {};
    for (const f of fields) {
      let val = document.getElementById(`prod-${f}`)?.value?.trim() || '';
      if (['costCNY', 'priceCNY', 'priceUSD', 'moq'].includes(f)) {
        val = val ? parseFloat(val) : 0;
      }
      data[f] = val;
    }
    data.projectId = project;

    if (!data.name) { Utils.showToast('请填写产品名称', 'warning'); return; }

    if (editId) {
      DB.updateProduct(project, editId, data);
      Utils.showToast('✅ 产品已更新');
    } else {
      DB.addProduct(project, data);
      Utils.showToast('✅ 产品添加成功');
    }

    Utils.closeModal();
    App.render();
  },

  showDetail(project, id) {
    const product = DB.findProduct(project, id);
    if (!product) return;

    const usdPrice = parseFloat(product.priceUSD) || Utils.cnyToUsd(parseFloat(product.priceCNY));
    const profit = (parseFloat(product.priceCNY)||0) - (parseFloat(product.costCNY)||0);

    const body = `
      <div class="product-detail">
        <h3>${product.name} <span style="font-size:14px;color:#999;">${product.model || ''}</span></h3>
        
        <div class="detail-grid" style="margin-top:16px;">
          <div class="detail-item"><span class="detail-label">分类</span>${product.category || '-'}</div>
          <div class="detail-item"><span class="detail-label">单位</span>${product.unit || '个'}</div>
          <div class="detail-item"><span class="detail-label">起订量</span>${product.moq || '-'}</div>
          <div class="detail-item"><span class="detail-label">成本价</span><strong>¥${parseFloat(product.costCNY||0).toFixed(2)}</strong></div>
          <div class="detail-item"><span class="detail-label">CNY售价</span><strong style="color:#2563eb;font-size:16px;">¥${parseFloat(product.priceCNY||0).toFixed(2)}</strong></div>
          <div class="detail-item"><span class="detail-label">USD售价</span><strong style="color:#10b981;font-size:16px;">$${usdPrice.toFixed(2)}</strong></div>
          <div class="detail-item"><span class="detail-label">预估利润/件</span><strong style="color:${profit>=0?'#10b981':'#ef4444'}">¥${profit.toFixed(2)}</strong></div>
          <div class="detail-item full-width"><span class="detail-label">描述</span>${product.description || '-'}</div>
        </div>
      </div>
    `;

    const footer = `<button class="btn btn-primary" onclick="Products.generateQuote('${project}','${id}');Utils.closeModal();">🖨️ 生成报价单</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">关闭</button>`;
    Utils.openModal('📦 产品详情', body, footer);
  },

  // 生成报价单（打印视图）
  generateQuote(project, id) {
    const product = DB.findProduct(project, id);
    if (!product) return;

    const usdPrice = parseFloat(product.priceUSD) || Utils.cnyToUsd(parseFloat(product.priceCNY));
    const today = new Date().toLocaleDateString('zh-CN');
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';

    const quoteHtml = `
<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>报价单 - ${product.name}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'PingFang SC','Microsoft YaHei',sans-serif; padding:40px; max-width:800px;margin:0 auto; color:#333;}
  .quote-header { border-bottom:3px double #333; padding-bottom:20px; margin-bottom:30px; display:flex;justify-content:space-between;align-items:flex-end; }
  .quote-logo h1 { font-size:28px; color:#1a1a1a; } .quote-logo p { color:#666; font-size:14px; margin-top:4px; }
  .quote-info { text-align:right; line-height:1.8; font-size:14px; }
  .quote-title { text-align:center; font-size:22px; font-weight:bold; margin-bottom:24px; letter-spacing:4px; }
  .quote-table { width:100%; border-collapse:collapse; margin-bottom:30px; }
  .quote-table th { background:#1a1a1a; color:#fff; padding:12px 16px; text-align:left; font-size:14px; }
  .quote-table td { border:1px solid #ddd; padding:12px 16px; font-size:14px; }
  .quote-total { text-align:right; font-size:18px; margin-bottom:30px; padding:16px; background:#f9f9f9; border:1px solid #ddd; }
  .quote-notes { font-size:13px; color:#666; line-height:2; margin-bottom:20px; }
  .quote-footer { border-top:1px solid #ddd; padding-top:16px; font-size:12px; color:#999; text-align:center; }
  @media print { body { padding:20px; } .no-print { display:none !important; } }
</style></head><body>
  <div class="quote-header">
    <div class="quote-logo"><h1>外贸SOHO</h1><p>${projName} | 专业出口供应商</p></div>
    <div class="quote-info">
      报价单 No.: QT-${Date.now().toString(-6)}<br>
      日期: ${today}<br>
      有效期: 30天
    </div>
  </div>

  <div class="quote-title">QUOTATION / 报 价 单</div>

  <table class="quote-table">
    <thead><tr><th>#</th><th>产品名称 / Product Name</th><th>规格/型号</th><th>单位</th><th>MOQ</th><th>单价(USD)</th></tr></thead>
    <tbody><tr>
      <td align="center">1</td>
      <td><strong>${product.name}</strong></td>
      <td>${product.model || '-'}</td>
      <td align="center">${product.unit || '个'}</td>
      <td align="center">${product.moq || '-'}</td>
      <td align="right"><strong>$${usdPrice.toFixed(2)}</strong></td>
    </tr></tbody>
  </table>

  <div class="quote-total">
    总计 (Total): &nbsp;&nbsp; USD <strong style="font-size:24px;">$${usdPrice.toFixed(2)}</strong> / 件
  </div>

  <div class="quote-notes">
    <strong>备注 Notes:</strong><br>
    1. 以上价格为FOB/Shanghai价格，含普通包装。<br>
    2. 交货期：收到定金后15-25个工作日，具体以订单确认为准。<br>
    3. 付款方式：TT 30%预付，余款见提单复印件付清。<br>
    4. 包装：标准出口包装。特殊包装需求请联系确认。<br>
    5. 此报价有效期为30天。
  </div>

  <div class="quote-footer">
    本报价单由外贸CRM系统生成 · 如有任何疑问请联系我们<br>
    Thank you for your business!
  </div>

  <div class="no-print" style="margin-top:30px;text-align:center;">
    <button onclick="window.print()" style="padding:12px 36px;font-size:18px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;">🖨️ 打印 / 导出PDF</button>
    <button onclick="window.close()" style="padding:12px 36px;font-size:18px;margin-left:12px;background:#eee;border:none;border-radius:8px;cursor:pointer;">关闭</button>
  </div>
</body></html>`;

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(quoteHtml);
    printWin.document.close();
  },

  confirmDelete(project, id, name) {
    if (Utils.confirm(`确定要删除产品「${name}」吗？`)) {
      DB.deleteProduct(project, id);
      Utils.showToast('产品已删除');
      App.render();
    }
  }
};
