// ============================================
// orders.js - 订单&财务记账模块
// ============================================

const Orders = {
  currentFilter: { status: '', search: '' },

  render(project) {
    const orders = DB.getOrders(project);
    const customers = DB.getCustomers(project);
    const filtered = this._filter(orders);
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';

    return `
      <div class="page-orders">
        <div class="page-header">
          <h2 class="page-title">📦 订单管理 · ${projName}项目</h2>
          <button class="btn btn-primary" onclick="Orders.showAddForm('${project}')">➕ 新增订单</button>
        </div>

        <!-- 筛选栏 -->
        <div class="filter-bar">
          <input type="text" id="order-search" class="search-input"
            placeholder="🔍 搜索客户名、产品名、跟踪号..." value="${this.currentFilter.search}"
            oninput="Orders.currentFilter.search=this.value; App.render()">
          <select id="order-status-filter" onchange="Orders.currentFilter.status=this.value; App.render()">
            <option value="">全部状态</option>
            <option value="待确认" ${this.currentFilter.status === '待确认' ? 'selected' : ''}>⏳ 待确认</option>
            <option value="生产中" ${this.currentFilter.status === '生产中' ? 'selected' : ''}>🏭 生产中</option>
            <option value="已发货" ${this.currentFilter.status === '已发货' ? 'selected' : ''}>🚢 已发货</option>
            <option value="已完成" ${this.currentFilter.status === '已完成' ? 'selected' : ''}>✅ 已完成</option>
            <option value="已取消" ${this.currentFilter.status === '已取消' ? 'selected' : ''}>❌ 已取消</option>
          </select>
          <span class="result-count">${filtered.length} 条结果 / 共 ${orders.length} 个订单</span>
        </div>

        <!-- 订单列表 -->
        ${filtered.length > 0 ? `
          <table class="data-table hoverable">
            <thead>
              <tr><th>客户</th><th>产品</th><th>数量</th><th>单价</th><th>总金额</th>
                <th>已付款</th><th>状态</th><th>利润</th><th>日期</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${filtered.map(o => {
                const paidPct = o.totalAmount > 0 ? ((o.paidAmount || 0) / o.totalAmount * 100).toFixed(0) : 0;
                return `<tr id="order-row-${o.id}">
                  <td><strong>${o.customerName || '-'}</strong></td>
                  <td>${o.productName || '-'}</td>
                  <td>${o.quantity || '-'}</td>
                  <td>${o.unitPrice ? Utils.formatCurrency(o.unitPrice, o.currency) : '-'}</td>
                  <td>${Utils.formatCurrency(o.totalAmount, o.currency)}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:4px;">
                      ${Utils.formatCurrency(o.paidAmount, o.currency)}
                      <span class="mini-badge">${paidPct}%</span>
                    </div>
                  </td>
                  <td>
                    <select class="badge-select badge-order-${o.status}"
                      onchange="Orders.updateStatus('${project}','${o.id}',this.value)">
                      ${['待确认','生产中','已发货','已完成','已取消'].map(s =>
                        `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`
                      ).join('')}
                    </select>
                  </td>
                  <td style="color:${(o.profit||0)>=0?'#10b981':'#ef4444'}">${Utils.formatCurrency(o.profit, o.currency)}</td>
                  <td>${Utils.formatDate(o.orderDate)}</td>
                  <td class="action-cell">
                    <button class="btn-sm btn-link" onclick="Orders.showDetail('${project}','${o.id}')">详情</button>
                    <button class="btn-sm btn-link" onclick="Orders.showEditForm('${project}','${o.id}')">编辑</button>
                    <button class="btn-sm btn-danger" onclick="Orders.confirmDelete('${project}','${o.id}')">删除</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        ` : '<p class="empty-text">暂无订单数据，点击上方按钮添加第一个订单 📝</p>'}
      </div>
    `;
  },

  // 财务页面渲染
  renderFinance(project) {
    const fs = DB.financeStats(project);
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';

    return `
      <div class="page-finance">
        <h2 class="page-title">💰 财务概览 · ${projName}项目</h2>

        <!-- 财务统计卡片 -->
        <div class="stats-grid finance-stats">
          <div class="stat-card stat-money"><div class="stat-icon">💵</div><div class="stat-info">
            <div class="stat-value">${Utils.formatCurrency(fs.totalOrderValue)}</div><div class="stat-label">订单总额</div></div></div>
          <div class="stat-card stat-success"><div class="stat-icon">🏦</div><div class="stat-info">
            <div class="stat-value">${Utils.formatCurrency(fs.totalRevenue)}</div><div class="stat-label">已收款</div></div></div>
          <div class="stat-card stat-danger"><div class="stat-icon">💸</div><div class="stat-info">
            <div class="stat-value">${Utils.formatCurrency(fs.totalCost)}</div><div class="stat-label">成本总额</div></div></div>
          <div class="stat-card stat-primary"><div class="stat-icon">📈</div><div class="stat-info">
            <div class="stat-value" style="color:${fs.totalProfit>=0?'#10b981':'#ef4444'}">${Utils.formatCurrency(fs.totalProfit)}</div><div class="stat-label">净利润</div></div></div>
          <div class="stat-card stat-warning"><div class="stat-icon">⏳</div><div class="stat-info">
            <div class="stat-value">${Utils.formatCurrency(fs.totalReceivable)}</div><div class="stat-label">应收款</div></div></div>
        </div>

        <!-- 按月统计 -->
        <div class="dashboard-section">
          <h3>📅 月度收支趋势</h3>
          ${fs.monthlyStats.length > 0 ? `
            <table class="data-table">
              <thead><tr><th>月份</th><th>订单数</th><th>收入金额</th><th>利润</th></tr></thead>
              <tbody>
                ${fs.monthlyStats.map(([month, data]) => `
                  <tr>
                    <td><strong>${month}</strong></td>
                    <td>${data.count} 单</td>
                    <td>${Utils.formatCurrency(data.revenue)}</td>
                    <td style="color:${data.profit>=0?'#10b981':'#ef4444'}">${Utils.formatCurrency(data.profit)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="empty-text">暂无财务数据</p>'}
        </div>

        <!-- 进行中的订单（应收） -->
        ${fs.activeOrders.length > 0 ? `
          <div class="dashboard-section">
            <h3>⏳ 进行中订单 (${fs.activeOrders.length})</h3>
            <table class="data-table hoverable">
              <thead><tr><th>客户</th><th>产品</th><th>总额</th><th>已付款</th><th>应收</th><th>状态</th></tr></thead>
              <tbody>
                ${fs.activeOrders.map(o => {
                  const remain = (parseFloat(o.totalAmount)||0) - (parseFloat(o.paidAmount)||0);
                  return `<tr>
                    <td><strong>${o.customerName||'-'}</strong></td>
                    <td>${o.productName||'-'}</td>
                    <td>${Utils.formatCurrency(o.totalAmount, o.currency)}</td>
                    <td>${Utils.formatCurrency(o.paidAmount, o.currency)}</td>
                    <td style="color:#f59e0b;font-weight:bold;">${Utils.formatCurrency(remain, o.currency)}</td>
                    <td><span class="badge badge-order-${o.status}">${o.status}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  },

  _filter(orders) {
    return orders.filter(o => {
      if (this.currentFilter.status && o.status !== this.currentFilter.status) return false;
      if (this.currentFilter.search) {
        const q = this.currentFilter.search.toLowerCase();
        const fields = [o.customerName, o.productName, o.trackingNo, o.notes, o.paymentMethod].join(' ').toLowerCase();
        if (!fields.includes(q)) return false;
      }
      return true;
    });
  },

  updateStatus(project, id, newStatus) {
    DB.updateOrder(project, id, { status: newStatus });
    Utils.showToast(`订单状态更新为「${newStatus}」`, 'success');
    App.render();
  },

  showAddForm(project) {
    const customers = DB.getCustomers(project);
    const products = DB.getProducts(project);
    const body = this._formHTML(project, null, customers, products);
    const footer = `<button class="btn btn-primary" onclick="Orders.saveOrder('${project}',null)">创建订单</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('➕ 新增订单', body, footer);
  },

  showEditForm(project, id) {
    const order = DB.findOrder(project, id);
    if (!order) { Utils.showToast('订单不存在', 'error'); return; }
    const customers = DB.getCustomers(project);
    const products = DB.getProducts(project);
    const body = this._formHTML(project, order, customers, products);
    const footer = `<button class="btn btn-primary" onclick="Orders.saveOrder('${project}','${id}')">保存修改</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('✏️ 编辑订单', body, footer);

    setTimeout(() => {
      Object.keys(order).forEach(key => {
        const el = document.getElementById(`ord-${key}`);
        if (el && order[key] !== undefined && order[key] !== null) el.value = order[key];
      });
    }, 50);
  },

  _formHTML(project, data, customers, products) {
    const customerOptions = customers.map(c => 
      `<option value="${c.id}" ${(data && data.customerRef === c.id) ? 'selected' : ''}>${c.name} (${c.company || '无公司'})</option>`
    ).join('');

    return `
      <form id="order-form" onsubmit="return false;">
        <div class="form-grid">
          <div class="form-group">
            <label for="ord-customerRef">关联客户 *</label>
            <select id="ord-customerRef">
              <option value="">-- 选择客户 --</option>
              ${customerOptions}
            </select>
          </div>
          <div class="form-group"><label for="ord-customerName">客户名称（手动输入也可）</label>
            <input type="text" id="ord-customerName" placeholder="或手动输入客户名"></div>
          
          <div class="form-group"><label for="ord-productName">产品/货品描述 *</label>
            <textarea id="ord-productName" rows="2" placeholder="如：304不锈钢保温杯 x 500个"></textarea></div>
          <div class="form-group"><label for="ord-quantity">数量</label>
            <input type="number" id="ord-quantity" placeholder="500" min="1"></div>
          
          <div class="form-group"><label for="ord-unitPrice">单价</label>
            <input type="number" id="ord-unitPrice" placeholder="9.48" step="0.01" min="0"></div>
          <div class="form-group"><label for="ord-currency">币种</label>
            <select id="ord-currency">
              <option value="USD" ${(data && data.currency==='USD')?'selected':''}>USD 美元</option>
              <option value="CNY" ${(data && data.currency==='CNY')?'selected':''}>CNY 人民币</option>
              <option value="MXN" ${(data && data.currency==='MXN')?'selected':''}>MXN 墨西哥比索</option>
              <option value="EUR" {(data && data.currency==='EUR')?'selected':''}>EUR 欧元</option>
            </select>
          </div>
          
          <div class="form-group"><label for="ord-totalAmount">总金额</label>
            <input type="number" id="ord-totalAmount" placeholder="自动计算=数量×单价" step="0.01"></div>
          <div class="form-group"><label for="ord-paidAmount">已付款金额</label>
            <input type="number" id="ord-paidAmount" placeholder="0" step="0.01" min="0"></div>
          <div class="form-group"><label for="ord-profit">预估利润</label>
            <input type="number" id="ord-profit" placeholder="估算利润" step="0.01"></div>
          <div class="form-group"><label for="ord-status">状态</label>
            <select id="ord-status">
              <option value="待确认">待确认</option><option value="生产中">生产中</option>
              <option value="已发货">已发货</option><option value="已完成">已完成</option><option value="已取消">已取消</option>
            </select>
          </div>
          
          <div class="form-group"><label for="ord-orderDate">下单日期</label><input type="date" id="ord-orderDate" value="${Utils.today()}"></div>
          <div class="form-group"><label for="ord-shipDate">发货日期</label><input type="date" id="ord-shipDate"></div>
          
          <div class="form-group"><label for="ord-paymentMethod">付款方式</label>
            <select id="ord-paymentMethod">
              <option value="">请选择</option><option>TT 电汇</option><option>TT 30%预付</option>
              <option>TT 50%预付</option><option>L/C 信用证</option><option>PayPal</option><option>西联汇款</option><option>其他</option>
            </select>
          </div>
          <div class="form-group"><label for="ord-trackingNo">物流追踪号</label><input type="text" id="ord-trackingNo" placeholder="快递单号/B/L号"></div>
          
          <div class="form-group full-width"><label for="ord-notes">备注</label>
            <textarea id="ord-notes" rows="3" placeholder="特殊要求、包装说明等..."></textarea></div>
        </div>

        <div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#666;">
            💡 提示：填写数量和单价后，可点击下方按钮自动计算总金额。利润需根据实际成本手动填写。
          </p>
          <button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;"
            onclick="const qty=document.getElementById('ord-quantity').value;const up=document.getElementById('ord-unitPrice').value;if(qty&&up){document.getElementById('ord-totalAmount').value=(qty*up).toFixed(2);}else{Utils.showToast('先填数量和单价','warning')}">
            🧮 自动计算总金额
          </button>
        </div>
      </form>
    `;
  },

  saveOrder(project, editId) {
    const fields = ['customerRef','customerName','productName','quantity','unitPrice',
      'currency','totalAmount','paidAmount','profit','status','orderDate','shipDate',
      'paymentMethod','trackingNo','notes'];
    
    const data = {};
    for (const f of fields) {
      let val = document.getElementById(`ord-${f}`)?.value?.trim() || '';
      // 数字字段转换
      if (['quantity','unitPrice','totalAmount','paidAmount','profit'].includes(f)) {
        val = val ? parseFloat(val) : 0;
      }
      data[f] = val;
    }

    if (!data.productName) { Utils.showToast('请填写产品描述', 'warning'); return; }

    if (editId) {
      DB.updateOrder(project, editId, data);
      Utils.showToast('✅ 订单已更新');
    } else {
      DB.addOrder(project, data);
      Utils.showToast('✅ 订单创建成功');
    }

    Utils.closeModal();
    App.render();
  },

  showDetail(project, id) {
    const order = DB.findOrder(project, id);
    if (!order) return;

    const customer = order.customerRef ? DB.findCustomer(project, order.customerRef) : null;
    const remain = (parseFloat(order.totalAmount)||0) - (parseFloat(order.paidAmount)||0);

    const body = `
      <div class="order-detail">
        <div class="detail-grid" style="grid-template-columns:1fr 1fr;">
          <div class="detail-item full-width"><span class="detail-label">产品</span><strong>${order.productName}</strong></div>
          <div class="detail-item"><span class="detail-label">数量</span>${order.quantity || '-'}</div>
          <div class="detail-item"><span class="detail-label">单价</span>${order.unitPrice ? Utils.formatCurrency(order.unitPrice, order.currency) : '-'}</div>
          <div class="detail-item"><span class="detail-label">总金额</span><strong style="font-size:16px;color:#2563eb;">${Utils.formatCurrency(order.totalAmount, order.currency)}</strong></div>
          <div class="detail-item"><span class="detail-label">已付款</span><strong>${Utils.formatCurrency(order.paidAmount, order.currency)}</strong></div>
          <div class="detail-item"><span class="detail-label">应收余额</span><strong style="color:#f59e0b;">${Utils.formatCurrency(remain, order.currency)}</strong></div>
          <div class="detail-item"><span class="detail-label">预估利润</span><strong style="color:${(order.profit||0)>=0?'#10b981':'#ef4444'}">${Utils.formatCurrency(order.profit, order.currency)}</strong></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="badge badge-order-${order.status}">${order.status}</span></div>
          <div class="detail-item"><span class="detail-label">客户</span>${customer ? `${customer.name} (${customer.company})` : (order.customerName || '-')}</div>
          <div class="detail-item"><span class="detail-label">下单日期</span>${Utils.formatDate(order.orderDate)}</div>
          <div class="detail-item"><span class="detail-label">发货日期</span>${Utils.formatDate(order.shipDate) || '-'}</div>
          <div class="detail-item"><span class="detail-label">付款方式</span>${order.paymentMethod || '-'}</div>
          <div class="detail-item"><span class="detail-label">追踪号</span>${order.trackingNo || '-'}</div>
          <div class="detail-item full-width"><span class="detail-label">备注</span>${order.notes || '-'}</div>
        </div>
        
        <!-- 快速收款 -->
        ${remain > 0.01 && order.status !== '已取消' && order.status !== '已完成' ? `
          <div style="margin-top:16px;padding:12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
            <h4 style="margin:0 0 8px;">快速记录收款</h4>
            <div style="display:flex;gap:8px;align-items:center;">
              <label>收款金额:</label>
              <input type="number" id="quick-pay-amount" placeholder="${remain.toFixed(2)}" step="0.01" style="flex:1;padding:6px;border:1px solid #d1d5db;border-radius:4px;">
              <button class="btn btn-success btn-sm" onclick="Orders.quickPayment('${project}','${id}',${remain})">确认收款</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footer = `<button class="btn btn-outline" onclick="Orders.showEditForm('${project}','${id}');Utils.closeModal();setTimeout(()=>Orders.showEditForm('${project}','${id}'),100)">编辑</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">关闭</button>`;
    Utils.openModal('📦 订单详情', body, footer);
  },

  quickPayment(project, id, currentReceivable) {
    const amount = parseFloat(document.getElementById('quick-pay-amount')?.value);
    if (!amount || amount <= 0) { Utils.showToast('请输入有效金额', 'warning'); return; }
    if (amount > currentReceivable) { Utils.showToast('收款金额不能超过应收余额', 'warning'); return; }

    const order = DB.findOrder(project, id);
    const newPaid = (parseFloat(order.paidAmount) || 0) + amount;
    DB.updateOrder(project, id, { paidAmount: newPaid });

    // 自动判断状态
    if (Math.abs(newPaid - parseFloat(order.totalAmount)) < 0.01) {
      DB.updateOrder(project, id, { status: '已完成' });
    }

    Utils.showToast(`✅ 已记录收款 ${Utils.formatCurrency(amount)}`);
    Utils.closeModal();
    App.render();
  },

  confirmDelete(project, id) {
    if (Utils.confirm('确定要删除这个订单吗？')) {
      DB.deleteOrder(project, id);
      Utils.showToast('订单已删除');
      App.render();
    }
  }
};
