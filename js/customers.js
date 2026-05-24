// ============================================
// customers.js - 客户管理模块
// ============================================

const Customers = {
  currentFilter: { stage: '', search: '' },

  render(project) {
    const customers = DB.getCustomers(project);
    const filtered = this._filter(customers);
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';

    return `
      <div class="page-customers">
        <div class="page-header">
          <h2 class="page-title">👥 客户管理 · ${projName}项目</h2>
          <button class="btn btn-primary" onclick="Customers.showAddForm('${project}')">
            ➕ 新增客户
          </button>
        </div>

        <!-- 筛选栏 -->
        <div class="filter-bar">
          <input type="text" id="customer-search" class="search-input"
            placeholder="🔍 搜索客户名、公司、邮箱、国家..." value="${this.currentFilter.search}"
            oninput="Customers.currentFilter.search=this.value; App.render()">
          <select id="stage-filter" onchange="Customers.currentFilter.stage=this.value; App.render()">
            <option value="">全部阶段</option>
            <option value="新线索" ${this.currentFilter.stage === '新线索' ? 'selected' : ''}>🌱 新线索</option>
            <option value="已联系" ${this.currentFilter.stage === '已联系' ? 'selected' : ''}>📞 已联系</option>
            <option value="报价中" ${this.currentFilter.stage === '报价中' ? 'selected' : ''}>💰 报价中</option>
            <option value="谈判中" ${this.currentFilter.stage === '谈判中' ? 'selected' : ''}>🤝 谈判中</option>
            <option value="成交" ${this.currentFilter.stage === '成交' ? 'selected' : ''}>✅ 成交</option>
            <option value="流失" ${this.currentFilter.stage === '流失' ? 'selected' : ''}>❌ 流失</option>
          </select>
          <span class="result-count">${filtered.length} 条结果 / 共 ${customers.length} 位客户</span>
        </div>

        <!-- 客户列表 -->
        ${filtered.length > 0 ? `
          <table class="data-table hoverable">
            <thead>
              <tr>
                <th>客户名</th><th>公司</th><th>邮箱</th><th>国家</th>
                <th>跟进阶段</th><th>下次跟进</th><th>来源</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(c => `
                <tr id="customer-row-${c.id}">
                  <td><strong>${c.name}</strong></td>
                  <td>${c.company || '-'}</td>
                  <td>${c.email || '-'}</td>
                  <td>${c.country || '-'}</td>
                  <td>
                    <select class="badge-select badge-${this._stageClass(c.stage)}"
                      onchange="Customers.updateStage('${project}', '${c.id}', this.value)">
                      ${['新线索','已联系','报价中','谈判中','成交','流失'].map(s =>
                        `<option value="${s}" ${c.stage === s ? 'selected' : ''}>${s}</option>`
                      ).join('')}
                    </select>
                  </td>
                  <td>${c.nextFollowUp ? Utils.formatDate(c.nextFollowUp) : '<span style="color:#999">未设置</span>'}</td>
                  <td>${c.source || '-'}</td>
                  <td class="action-cell">
                    <button class="btn-sm btn-link" onclick="Customers.showDetail('${project}', '${c.id}')">详情</button>
                    <button class="btn-sm btn-link" onclick="Customers.showEditForm('${project}', '${c.id}')">编辑</button>
                    <button class="btn-sm btn-danger" onclick="Customers.confirmDelete('${project}', '${c.id}', '${c.name.replace(/'/g, "\\'")}')">删除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="empty-text">暂无客户数据，点击上方按钮添加第一位客户吧 🎉</p>'}
      </div>
    `;
  },

  _filter(customers) {
    return customers.filter(c => {
      if (this.currentFilter.stage && c.stage !== this.currentFilter.stage) return false;
      if (this.currentFilter.search) {
        const q = this.currentFilter.search.toLowerCase();
        const fields = [c.name, c.company, c.email, c.phone, c.country, c.city, c.notes].join(' ').toLowerCase();
        if (!fields.includes(q)) return false;
      }
      return true;
    });
  },

  _stageClass(stage) {
    const map = { '新线索': 'new', '已联系': 'contacted', '报价中': 'quoting', '谈判中': 'negotiating', '成交': 'won', '流失': 'lost' };
    return map[stage] || '';
  },

  // 快速更新阶段
  updateStage(project, id, newStage) {
    DB.updateCustomer(project, id, { stage: newStage });
    Utils.showToast(`已更新为「${newStage}」`, 'success');
    App.render();
  },

  // 新增表单
  showAddForm(project) {
    const body = this._formHTML(null);
    const footer = `<button class="btn btn-primary" onclick="Customers.saveCustomer('${project}', null)">保存客户</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('➕ 新增客户', body, footer);
  },

  // 编辑表单
  showEditForm(project, id) {
    const customer = DB.findCustomer(project, id);
    if (!customer) { Utils.showToast('客户不存在', 'error'); return; }
    const body = this._formHTML(customer);
    const footer = `<button class="btn btn-primary" onclick="Customers.saveCustomer('${project}', '${id}')">保存修改</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">取消</button>`;
    Utils.openModal('✏️ 编辑客户', body, footer);

    // 填充数据
    setTimeout(() => {
      Object.keys(customer).forEach(key => {
        const el = document.getElementById(`cust-${key}`);
        if (el && customer[key] !== undefined && customer[key] !== null) el.value = customer[key];
      });
    }, 50);
  },

  // 表单HTML
  _formHTML(data) {
    return `
      <form id="customer-form" onsubmit="return false;">
        <div class="form-grid">
          <div class="form-group"><label for="cust-name">姓名 *</label><input type="text" id="cust-name" required placeholder="客户联系人姓名"></div>
          <div class="form-group"><label for="cust-company">公司</label><input type="text" id="cust-company" placeholder="公司名称"></div>
          <div class="form-group"><label for="cust-email">邮箱</label><input type="email" id="cust-email" placeholder="email@example.com"></div>
          <div class="form-group"><label for="cust-phone">电话</label><input type="text" id="cust-phone" placeholder="+xx xxx xxxx"></div>
          <div class="form-group"><label for="cust-country">国家</label><input type="text" id="cust-country" placeholder="墨西哥/美国/..."></div>
          <div class="form-group"><label for="cust-city">城市</label><input type="text" id="cust-city" placeholder="城市"></div>
          <div class="form-group full-width"><label for="cust-address">地址</label><input type="text" id="cust-address" placeholder="详细地址"></div>
          <div class="form-group"><label for="cust-source">来源</label>
            <select id="cust-source">
              <option value="">请选择</option>
              <option>展会</option><option>Alibaba</option><option>Google搜索</option>
              <option>LinkedIn</option><option>Instagram</option><option>网站留言</option><option>朋友推荐</option><option>其他</option>
            </select>
          </div>
          <div class="form-group"><label for="cust-stage">跟进阶段</label>
            <select id="cust-stage">
              <option value="新线索">🌱 新线索</option>
              <option value="已联系">📞 已联系</option>
              <option value="报价中">💰 报价中</option>
              <option value="谈判中">🤝 谈判中</option>
              <option value="成交">✅ 成交</option>
              <option value="流失">❌ 流失</option>
            </select>
          </div>
          <div class="form-group"><label for="cust-nextFollowUp">下次跟进日期</label><input type="date" id="cust-nextFollowUp"></div>
          <div class="form-group full-width"><label for="cust-notes">备注</label>
            <textarea id="cust-notes" rows="3" placeholder="沟通记录、特殊需求、注意事项..."></textarea></div>
        </div>
      </form>
    `;
  },

  // 保存
  saveCustomer(project, editId) {
    const fields = ['name', 'company', 'email', 'phone', 'country', 'city', 'address',
      'source', 'stage', 'nextFollowUp', 'notes'];
    const data = {};
    for (const f of fields) {
      data[f] = document.getElementById(`cust-${f}`)?.value?.trim() || '';
    }

    if (!data.name) { Utils.showToast('请填写客户姓名', 'warning'); return; }

    if (editId) {
      DB.updateCustomer(project, editId, data);
      Utils.showToast('✅ 客户信息已更新');
    } else {
      DB.addCustomer(project, data);
      Utils.showToast('✅ 客户添加成功');
    }

    Utils.closeModal();
    App.render();
  },

  // 详情
  showDetail(project, id) {
    const customer = DB.findCustomer(project, id);
    if (!customer) return;

    const orders = DB.getOrders(project).filter(o => o.customerRef === id);
    const projColor = project === 'coffee-cups' ? '#8B4513' : '#228B22';

    const body = `
      <div class="customer-detail">
        <div class="detail-header" style="border-left:4px solid ${projColor};padding-left:12px;">
          <h3 style="margin:0;">${customer.name}</h3>
          <p style="color:#666;margin:4px 0 0;">${customer.company || '无公司'} · ${customer.country || '未知'} ${customer.city || ''}</p>
        </div>

        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">邮箱</span>${customer.email || '-'}</div>
          <div class="detail-item"><span class="detail-label">电话</span>${customer.phone || '-'}</div>
          <div class="detail-item"><span class="detail-label">来源</span>${customer.source || '-'}</div>
          <div class="detail-item"><span class="detail-label">阶段</span>
            <span class="badge badge-${this._stageClass(customer.stage)}">${customer.stage}</span></div>
          <div class="detail-item"><span class="detail-label">下次跟进</span>${customer.nextFollowUp ? Utils.formatDate(customer.nextFollowUp) : '未设置'}</div>
          <div class="detail-item"><span class="detail-label">创建时间</span>${Utils.formatDateTime(customer.createdAt)}</div>
          <div class="detail-item full-width"><span class="detail-label">地址</span>${customer.address || '-'}</div>
          <div class="detail-item full-width"><span class="detail-label">备注</span>${customer.notes || '<span style="color:#999">无备注</span>'}</div>
        </div>

        ${orders.length > 0 ? `
          <h4 style="margin-top:16px;">关联订单 (${orders.length})</h4>
          <table class="data-table">
            <thead><tr><th>产品</th><th>金额</th><th>状态</th><th>订单日期</th></tr></thead>
            <tbody>
              ${orders.map(o => `<tr><td>${o.productName}</td><td>${Utils.formatCurrency(o.totalAmount, o.currency)}</td>
                <td><span class="badge badge-order-${o.status}">${o.status}</span></td><td>${Utils.formatDate(o.orderDate)}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#999;margin-top:16px;">暂无关联订单</p>'}
      </div>
    `;

    const footer = `<button class="btn btn-outline" onclick="Customers.showEditForm('${project}','${id}');Utils.closeModal();setTimeout(()=>Customers.showEditForm('${project}','${id}'),100)">编辑</button>
                     <button class="btn btn-outline" onclick="Utils.closeModal()">关闭</button>`;
    Utils.openModal('👤 客户详情', body, footer);
  },

  // 删除确认
  confirmDelete(project, id, name) {
    if (Utils.confirm(`确定要删除客户「${name}」吗？\n\n关联的订单不会被删除，但将失去客户关联。`)) {
      DB.deleteCustomer(project, id);
      Utils.showToast('已删除客户');
      App.render();
    }
  },

  // 滚动到指定客户行
  scrollToCustomer(id) {
    setTimeout(() => {
      const row = document.getElementById(`customer-row-${id}`);
      if (row) {
        row.style.background = '#fff3cd';
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => row.style.background = '', 2000);
      }
    }, 300);
  }
};
