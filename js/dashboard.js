// ============================================
// dashboard.js - 仪表盘模块
// ============================================

const Dashboard = {
  render(project) {
    const stats = DB.stats(project);
    const projName = project === 'coffee-cups' ? '咖啡纸杯' : '马黛茶杯';
    const projColor = project === 'coffee-cups' ? 'coffee' : 'mate';

    return `
      <div class="dashboard">
        <h2 class="page-title">${projName}项目 · 仪表盘</h2>

        <!-- 统计卡片 -->
        <div class="stats-grid">
          <div class="stat-card stat-primary">
            <div class="stat-icon">👥</div>
            <div class="stat-info">
              <div class="stat-value">${stats.totalCustomers}</div>
              <div class="stat-label">客户总数</div>
            </div>
          </div>
          <div class="stat-card stat-success">
            <div class="stat-icon">🆕</div>
            <div class="stat-info">
              <div class="stat-value">+${stats.monthNewCustomers}</div>
              <div class="stat-label">本月新客户</div>
            </div>
          </div>
          <div class="stat-card stat-warning">
            <div class="stat-icon">⏰</div>
            <div class="stat-info">
              <div class="stat-value">${stats.pendingFollowUp}</div>
              <div class="stat-label">待跟进</div>
            </div>
          </div>
          <div class="stat-card stat-info">
            <div class="stat-icon">📦</div>
            <div class="stat-info">
              <div class="stat-value">${stats.totalOrders}</div>
              <div class="stat-label">订单总数</div>
            </div>
          </div>
          <div class="stat-card stat-money">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <div class="stat-value">${Utils.formatCurrency(stats.monthRevenue, 'USD')}</div>
              <div class="stat-label">本月订单金额</div>
            </div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-icon">📌</div>
            <div class="stat-info">
              <div class="stat-value">${Utils.formatCurrency(stats.receivable, 'USD')}</div>
              <div class="stat-label">应收款</div>
            </div>
          </div>
        </div>

        <!-- 客户阶段概览 -->
        <div class="dashboard-section">
          <h3>📊 客户跟进阶段</h3>
          <div class="stage-overview">
            ${Object.entries(stats.stageCounts).map(([stage, count]) => `
              <div class="stage-item" data-stage="${stage}">
                <span class="stage-dot stage-${stage}"></span>
                <span class="stage-name">${stage}</span>
                <span class="stage-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 两列布局 -->
        <div class="dashboard-row">

          <!-- 待跟进提醒 -->
          <div class="dashboard-panel flex-2">
            <h3>⏰ 待跟进客户 (${stats.pendingFollowUpList.length})</h3>
            ${stats.pendingFollowUpList.length > 0 ? `
              <table class="data-table">
                <thead><tr><th>客户名</th><th>公司</th><th>阶段</th><th>跟进日期</th><th>操作</th></tr></thead>
                <tbody>
                  ${stats.pendingFollowUpList.map(c => `
                    <tr>
                      <td><strong>${c.name}</strong></td>
                      <td>${c.company || '-'}</td>
                      <td><span class="badge badge-${this._stageClass(c.stage)}">${c.stage}</span></td>
                      <td>${Utils.formatDate(c.nextFollowUp)}</td>
                      <td>
                        <button class="btn-sm btn-link" onclick="App.navigate('customers'); App.scrollToCustomer('${c.id}')">查看</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="empty-text">暂无待跟进客户 ✨</p>'}
          </div>

          <!-- 最新动态 -->
          <div class="dashboard-panel flex-1">
            <h3>📋 最新动态</h3>
            <div class="recent-list">
              ${stats.recentOrders.slice(0, 3).map(o => `
                <div class="recent-item order-item">
                  <span class="recent-dot dot-order"></span>
                  <div class="recent-content">
                    <strong>${o.customerName || o.productName || '订单'}</strong>
                    <span class="recent-sub">${o.status}: ${Utils.formatCurrency(o.totalAmount, o.currency)}</span>
                  </div>
                  <span class="recent-time">${Utils.formatDate(o.orderDate || o.createdAt)}</span>
                </div>
              `).join('')}
              ${stats.recentCustomers.slice(0, 3).map(c => `
                <div class="recent-item customer-item">
                  <span class="recent-dot dot-customer"></span>
                  <div class="recent-content">
                    <strong>${c.name}</strong>
                    <span class="recent-sub">${c.company || ''} · ${c.stage}</span>
                  </div>
                  <span class="recent-time">${Utils.formatDate(c.createdAt)}</span>
                </div>
              `).join('')}
              ${stats.recentOrders.length === 0 && stats.recentCustomers.length === 0
                ? '<p class="empty-text">暂无数据，开始添加吧！</p>' : ''}
            </div>
          </div>

        </div>

        <!-- 订单状态 -->
        <div class="dashboard-section">
          <h3>📦 订单状态分布</h3>
          <div class="status-bars">
            ${Object.entries(stats.orderStatusCounts)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => {
                const total = stats.totalOrders || 1;
                const pct = Math.round(count / total * 100);
                return `
                  <div class="status-bar-item">
                    <div class="status-bar-label"><span>${status}</span><span>${count}单</span></div>
                    <div class="status-bar-track">
                      <div class="status-bar-fill status-${this._statusClass(status)}" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('') || '<p class="empty-text">暂无订单数据</p>'
            }
          </div>
        </div>
      </div>
    `;
  },

  _stageClass(stage) {
    const map = { '新线索': 'new', '已联系': 'contacted', '报价中': 'quoting', '谈判中': 'negotiating', '成交': 'won', '流失': 'lost' };
    return map[stage] || '';
  },

  _statusClass(status) {
    const map = { '待确认': 'pending', '生产中': 'producing', '已发货': 'shipped', '已完成': 'completed', '已取消': 'cancelled' };
    return map[status] || '';
  }
};
