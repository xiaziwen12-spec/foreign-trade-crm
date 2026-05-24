// ============================================
// data.js - 数据模型和存储操作（支持云端同步）
// ============================================

const DB = {
  PREFIX: 'crm_',
  PROJECTS: ['coffee-cups', 'mate-cups'],

  // ===== 云存储配置 (JSONBin.io) =====
  // 使用 JSONBin.io 作为免费云端数据库
  // 首次使用需要创建一个 bin，获取 BIN_ID 和 API_KEY
  CLOUD: {
    enabled: true,
    // 从 localStorage 读取（通过设置模态框配置后保存）
    apiKey: localStorage.getItem('crm_cloudApiKey') || '',
    binId: localStorage.getItem('crm_cloudBinId') || '',
    baseUrl: 'https://api.jsonbin.io/v3',
    // 同步防抖（毫秒）- 避免频繁写入
    syncDebounce: 2000,
    _syncTimer: null,
    _lastSync: null,
    _isOnline: navigator.onLine,

    // 检查是否已配置云存储
    isConfigured() {
      return this.apiKey && this.binId;
    },

    // 从云端读取全部数据
    async fetchAll() {
      if (!this.isConfigured()) return null;
      try {
        const resp = await fetch(`${this.baseUrl}/b/${this.binId}/latest`, {
          headers: { 'X-Master-Key': this.apiKey }
        });
        if (!resp.ok) {
          console.warn('云端读取失败:', resp.status);
          return null;
        }
        const json = await resp.json();
        return json.record?.data || null;
      } catch (e) {
        console.warn('网络异常，使用本地缓存:', e.message);
        return null;
      }
    },

    // 写入全部数据到云端
    async pushAll(data) {
      if (!this.isConfigured()) return false;
      try {
        const payload = { data, updatedAt: new Date().toISOString() };
        const resp = await fetch(`${this.baseUrl}/b/${this.binId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': this.apiKey
          },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          console.warn('云端写入失败:', resp.status);
          return false;
        }
        this._lastSync = new Date();
        console.log('✅ 云端同步成功', new Date().toLocaleTimeString());
        return true;
      } catch (e) {
        console.warn('云端写入失败:', e.message);
        Utils.showToast('⚠️ 云端同步失败，数据已保存在本地', 'warning');
        return false;
      }
    },
  },

  // ===== 本地缓存（始终可用作为降级方案）=====
  _key(project, type) {
    return `${this.PREFIX}${project}_${type}`;
  },

  get(project, type) {
    try {
      const data = localStorage.getItem(this._key(project, type));
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('读取本地数据失败:', e);
      return [];
    }
  },

  save(project, type, data) {
    localStorage.setItem(this._key(project, type), JSON.stringify(data));
    // 触发云端同步（防抖）
    this.scheduleCloudSync();
  },

  // ===== 云端同步调度 =====
  scheduleCloudSync() {
    if (!this.CLOUD.enabled || !this.CLOUD.isConfigured()) return;
    clearTimeout(this.CLOUD._syncTimer);
    this.CLOUD._syncTimer = setTimeout(() => this.cloudPush(), this.CLOUD.syncDebounce);
  },

  // 收集所有本地数据并推送到云端
  async cloudPush() {
    const allData = {};
    this.PROJECTS.forEach(proj => {
      allData[proj] = {
        customers: this.get(proj, 'customers'),
        orders: this.get(proj, 'orders'),
        products: this.get(proj, 'products'),
      };
    });
    await this.CLOUD.pushAll(allData);
  },

  // 从云端拉取数据并合并到本地
  async cloudPull() {
    const cloudData = await this.CLOUD.fetchAll();
    if (!cloudData) return false;

    let hasNewData = false;
    this.PROJECTS.forEach(proj => {
      if (cloudData[proj]) {
        ['customers', 'orders', 'products'].forEach(type => {
          if (cloudData[proj][type]) {
            const local = this.get(proj, type);
            // 云端数据更新则覆盖本地
            if (JSON.stringify(cloudData[proj][type]) !== JSON.stringify(local)) {
              this.saveLocalOnly(proj, type, cloudData[proj][type]);
              hasNewData = true;
            }
          }
        });
      }
    });

    if (hasNewData) {
      console.log('📥 已从云端拉取最新数据');
    }
    return hasNewData;
  },

  // 仅写本地（不触发云端同步，用于从云端拉取时）
  saveLocalOnly(project, type, data) {
    localStorage.setItem(this._key(project, type), JSON.stringify(data));
  },

  // 初始化：优先加载云端数据
  async initCloud() {
    if (!this.CLOUD.isConfigured()) {
      console.log('ℹ️ 云端未配置，使用纯本地模式');
      return false;
    }

    // 显示同步状态
    this._showSyncStatus('正在连接云端...');

    const pulled = await this.cloudPull();
    this._showSyncStatus(pulled ? '✅ 已同步云端最新数据' : '📡 使用本地数据');
    
    if (pulled) {
      // 如果App已经初始化，重新渲染
      if (typeof App !== 'undefined' && App.render) {
        App.render();
      }
    }

    return pulled;
  },

  _showSyncStatus(msg) {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = msg;

    // 同时在仪表盘显示
    const dashEl = document.getElementById('cloud-status-badge');
    if (dashEl) dashEl.textContent = msg;
  },

  // ---- 客户操作 ----
  getCustomers(project) { return this.get(project, 'customers'); },

  addCustomer(project, customer) {
    const list = this.getCustomers(project);
    const now = new Date().toISOString();
    customer.id = Utils.generateId();
    customer.createdAt = now;
    customer.updatedAt = now;
    customer.updatedBy = App.userName || '未知用户';
    if (!customer.stage) customer.stage = '新线索';
    list.push(customer);
    this.save(project, 'customers', list);
    return customer;
  },

  updateCustomer(project, id, updates) {
    const list = this.getCustomers(project);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString(), updatedBy: App.userName || '未知用户' };
    this.save(project, 'customers', list);
    return list[idx];
  },

  deleteCustomer(project, id) {
    let list = this.getCustomers(project);
    list = list.filter(c => c.id !== id);
    this.save(project, 'customers', list);
  },

  findCustomer(project, id) {
    return this.getCustomers(project).find(c => c.id === id) || null;
  },

  // ---- 订单操作 ----
  getOrders(project) { return this.get(project, 'orders'); },

  addOrder(project, order) {
    const list = this.getOrders(project);
    const now = new Date().toISOString();
    order.id = Utils.generateId();
    order.createdAt = now;
    order.updatedAt = now;
    order.updatedBy = App.userName || '未知用户';
    if (!order.status) order.status = '待确认';
    list.push(order);
    this.save(project, 'orders', list);
    return order;
  },

  updateOrder(project, id, updates) {
    const list = this.getOrders(project);
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString(), updatedBy: App.userName || '未知用户' };
    this.save(project, 'orders', list);
    return list[idx];
  },

  deleteOrder(project, id) {
    let list = this.getOrders(project);
    list = list.filter(o => o.id !== id);
    this.save(project, 'orders', list);
  },

  findOrder(project, id) {
    return this.getOrders(project).find(o => o.id === id) || null;
  },

  // ---- 产品操作 ----
  getProducts(project) { return this.get(project, 'products'); },

  addProduct(project, product) {
    const list = this.getProducts(project);
    const now = new Date().toISOString();
    product.id = Utils.generateId();
    product.createdAt = now;
    product.updatedAt = now;
    product.updatedBy = App.userName || '未知用户';
    list.push(product);
    this.save(project, 'products', list);
    return product;
  },

  updateProduct(project, id, updates) {
    const list = this.getProducts(project);
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString(), updatedBy: App.userName || '未知用户' };
    this.save(project, 'products', list);
    return list[idx];
  },

  deleteProduct(project, id) {
    let list = this.getProducts(project);
    list = list.filter(p => p.id !== id);
    this.save(project, 'products', list);
  },

  findProduct(project, id) {
    return this.getProducts(project).find(p => p.id === id) || null;
  },

  // ---- 统计方法 ----
  stats(project) {
    const customers = this.getCustomers(project);
    const orders = this.getOrders(project);
    const products = this.getProducts(project);
    const today = Utils.today();
    const monthFirstDay = Utils.monthFirstDay();

    const monthNewCustomers = customers.filter(c => c.createdAt >= monthFirstDay).length;

    const pendingFollowUp = customers.filter(c =>
      c.nextFollowUp && c.nextFollowUp >= today && c.stage !== '成交' && c.stage !== '流失'
    );

    const monthOrders = orders.filter(o => o.orderDate && o.orderDate >= monthFirstDay);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);

    const receivable = orders
      .filter(o => o.status !== '已取消' && o.status !== '已完成')
      .reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0) - (parseFloat(o.paidAmount) || 0), 0);

    const stageCounts = {};
    const stages = ['新线索', '已联系', '报价中', '谈判中', '成交', '流失'];
    stages.forEach(s => stageCounts[s] = 0);
    customers.forEach(c => {
      if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
    });

    const orderStatusCounts = {};
    const statuses = ['待确认', '生产中', '已发货', '已完成', '已取消'];
    statuses.forEach(s => orderStatusCounts[s] = 0);
    orders.forEach(o => {
      if (orderStatusCounts[o.status] !== undefined) orderStatusCounts[o.status]++;
    });

    return {
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalProducts: products.length,
      monthNewCustomers,
      pendingFollowUp: pendingFollowUp.length,
      pendingFollowUpList: pendingFollowUp.sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)),
      monthRevenue,
      monthOrderCount: monthOrders.length,
      receivable,
      stageCounts,
      orderStatusCounts,
      recentOrders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
      recentCustomers: customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
    };
  },

  financeStats(project) {
    const orders = DB.getOrders(project);
    const totalRevenue = orders
      .filter(o => o.status !== '已取消')
      .reduce((sum, o) => sum + (parseFloat(o.paidAmount) || 0), 0);

    const totalOrderValue = orders
      .filter(o => o.status !== '已取消')
      .reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);

    const totalProfit = orders
      .filter(o => o.status !== '已取消')
      .reduce((sum, o) => sum + (parseFloat(o.profit) || 0), 0);

    const totalReceivable = orders
      .filter(o => o.status !== '已取消' && o.status !== '已完成')
      .reduce((sum, o) => sum + ((parseFloat(o.totalAmount) || 0) - (parseFloat(o.paidAmount) || 0)), 0);

    const monthlyStats = {};
    orders.filter(o => o.status !== '已取消' && o.orderDate).forEach(o => {
      const month = o.orderDate.substring(0, 7);
      if (!monthlyStats[month]) monthlyStats[month] = { revenue: 0, profit: 0, count: 0 };
      monthlyStats[month].revenue += parseFloat(o.totalAmount) || 0;
      monthlyStats[month].profit += parseFloat(o.profit) || 0;
      monthlyStats[month].count += 1;
    });

    return {
      totalRevenue,
      totalOrderValue,
      totalProfit,
      totalReceivable,
      totalCost: totalOrderValue - totalProfit,
      monthlyStats: Object.entries(monthlyStats).sort((a, b) => b[0].localeCompare(a[0])),
      activeOrders: orders.filter(o => o.status !== '已完成' && o.status !== '已取消'),
    };
  },

  exportAll() {
    const data = {};
    this.PROJECTS.forEach(proj => {
      data[proj] = {
        customers: this.get(proj, 'customers'),
        orders: this.get(proj, 'orders'),
        products: this.get(proj, 'products'),
      };
    });
    data.exportTime = new Date().toISOString();
    data.version = '2.0';
    return JSON.stringify(data, null, 2);
  },

  importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.version) throw new Error('无效的备份文件');
      this.PROJECTS.forEach(proj => {
        if (data[proj]) {
          if (data[proj].customers) this.save(proj, 'customers', data[proj].customers);
          if (data[proj].orders) this.save(proj, 'orders', data[proj].orders);
          if (data[proj].products) this.save(proj, 'products', data[proj].products);
        }
      });
      return true;
    } catch (e) {
      console.error('导入失败:', e);
      return false;
    }
  },

  initSampleData() {
    if (this.getCustomers('mate-cups').length > 0) return;

    const mateCustomers = [
      {
        name: 'Gonzalo Monzo', company: 'WB POLANCO SA DE CV', email: 'gonzalomonzo@gmail.com',
        phone: '+52 55 4143 7030', country: '墨西哥', city: 'CDMX',
        address: 'Campeche 345, Col. Hipodromo, CDMX, Mexico',
        stage: '成交', source: '展会', nextFollowUp: '', notes: '核心客户，保温杯大单',
        createdAt: '2025-10-15T08:00:00.000Z', updatedAt: '2026-05-20T10:30:00.000Z'
      },
      {
        name: 'Maria Garcia', company: 'Termos Mexico S.A.', email: 'maria.garcia@termosmx.com',
        phone: '+52 33 1234 5678', country: '墨西哥', city: 'Guadalajara',
        address: '', stage: '报价中', source: 'Google搜索', nextFollowUp: '2026-05-28',
        notes: '对不锈钢保温杯感兴趣，需要报价500件起', createdAt: '2026-04-20T09:00:00.000Z', updatedAt: '2026-05-15T14:00:00.000Z'
      },
      {
        name: 'John Smith', company: 'Drinkware Co.', email: 'john@drinkwareco.us',
        phone: '+1 212 555 0100', country: '美国', city: 'New York',
        address: '123 Broadway, NY, USA', stage: '已联系', source: 'LinkedIn',
        nextFollowUp: '2026-06-01', notes: '寻找马黛茶杯供应商，关注品质认证',
        createdAt: '2026-03-10T16:00:00.000Z', updatedAt: '2026-05-10T11:00:00.000Z'
      },
      {
        name: 'Carlos Ruiz', company: 'Yerba Mate Market', email: 'carlos@yerbamarket.mx',
        phone: '+52 81 9876 5432', country: '墨西哥', city: 'Monterrey',
        address: '', stage: '谈判中', source: 'Instagram', nextFollowUp: '2026-05-26',
        notes: '价格敏感，正在对比其他供应商', createdAt: '2026-02-28T12:00:00.000Z', updatedAt: '2026-05-22T09:00:00.000Z'
      },
      {
        name: 'Ana Lopez', company: 'Café & Mate Store', email: 'ana@cafematestore.com.ar',
        phone: '+54 11 4567 8901', country: '阿根廷', city: 'Buenos Aires',
        address: '', stage: '新线索', source: '网站留言', nextFollowUp: '',
        notes: '通过官网联系表单咨询', createdAt: '2026-05-23T10:00:00.000Z', updatedAt: '2026-05-23T10:00:00.000Z'
      }
    ];

    const mateProducts = [
      { name: '304不锈钢真空保温杯', model: 'TM-VAC-500', category: '保温杯', unit: '个',
        costCNY: 25, costUSD: null, priceCNY: 38, priceUSD: 9.48,
        moq: 300, stock: '', description: '304食品级不锈钢，双层真空保温，保冷/保热12小时，容量500ml',
        images: '', projectId: 'mate-cups', createdAt: '', updatedAt: '' },
      { name: '经典马黛茶吸管杯', model: 'TM-MATE-750', category: '马黛茶杯', unit: '个',
        costCNY: 18, costUSD: null, priceCNY: 28, priceUSD: 6.99,
        moq: 500, stock: '', description: '带不锈钢吸管的传统马黛茶杯，容量750ml，适合热饮冷饮',
        images: '', projectId: 'mate-cups', createdAt: '', updatedAt: '' },
      { name: '商务款保温杯套装', model: 'TM-BIZ-SET', category: '套装', unit: '套',
        costCNY: 65, costUSD: null, priceCNY: 108, priceUSD: 26.94,
        moq: 100, stock: '', description: '含保温杯+杯套+清洁刷+礼盒包装，送礼首选',
        images: '', projectId: 'mate-cups', createdAt: '', updatedAt: '' },
      { name: '便携式随行杯', model: 'TM-GO-350', category: '随行杯', unit: '个',
        costCNY: 12, costUSD: null, priceCNY: 19.8, priceUSD: 4.94,
        moq: 1000, stock: '', description: '轻量设计，密封防漏，咖啡奶茶都适用，350ml',
        images: '', projectId: 'mate-cups', createdAt: '', updatedAt: '' },
      { name: '智能温显保温杯', model: 'TM-SMART-450', category: '智能杯', unit: '个',
        costCNY: 85, costUSD: null, priceCNY: 148, priceUSD: 36.91,
        moq: 200, stock: '', description: 'LED触摸显示温度，USB充电，304不锈钢内胆',
        images: '', projectId: 'mate-cups', createdAt: '', updatedAt: '' }
    ];

    const mateOrders = [
      { id: 'sample-order-1', customerRef: mateCustomers[0].id, customerName: mateCustomers[0].name,
        productName: '304不锈钢真空保温杯 x 500', quantity: 500,
        unitPrice: 9.48, currency: 'USD', totalAmount: 4740, paidAmount: 2370,
        status: '已发货', orderDate: '2026-04-10', shipDate: '2026-05-01',
        paymentMethod: 'TT 50%预付', trackingNo: 'MX20260501ABC',
        profit: 1896, notes: '第一批订单，50%预付余款见提单复印件付清',
        createdAt: '2026-04-08T10:00:00.000Z', updatedAt: '2026-05-02T14:00:00.000Z' },
      { id: 'sample-order-2', customerRef: mateCustomers[0].id, customerName: mateCustomers[0].name,
        productName: '经典马黛茶吸管杯 x 800 + 商务款保温杯套装 x 200', quantity: 1000,
        unitPrice: 0, currency: 'USD', totalAmount: 10890, paidAmount: 0,
        status: '生产中', orderDate: '2026-05-15', shipDate: '',
        paymentMethod: 'TT 30%预付', trackingNo: '',
        profit: 4390, notes: '复购订单，混合装柜', createdAt: '2026-05-14T09:00:00.000Z', updatedAt: '2026-05-18T16:00:00.000Z' }
    ];

    const coffeeCustomers = [
      { name: 'Coffee Bean Corp', company: 'Coffee Bean Corp', email: 'procurement@coffeebean.com',
        phone: '+1 310 555 8899', country: '美国', city: 'Los Angeles',
        address: '456 Coffee Ave, LA, CA', stage: '谈判中', source: 'Alibaba',
        nextFollowUp: '2026-05-27', notes: '月需求量20000只纸杯，要求定制印刷logo',
        createdAt: '2026-04-01T10:00:00.000Z', updatedAt: '2026-05-20T15:00:00.000Z' },
      { name: '张经理', company: '上海咖啡连锁有限公司', email: 'zhangmgr@shcafe.cn',
        phone: '+86 21 6666 8888', country: '中国', city: '上海',
        address: '上海市浦东新区', stage: '新线索', source: '展会',
        nextFollowUp: '', notes: 'HOTELEX展会认识的，对环保纸杯有兴趣',
        createdAt: '2026-05-22T14:00:00.000Z', updatedAt: '2026-05-22T14:00:00.000Z' }
    ];

    const coffeeProducts = [
      { name: '8oz单层咖啡纸杯', model: 'CC-8OZ-1P', category: '纸杯', unit: '只',
        costCNY: 0.18, costUSD: null, priceCNY: 0.32, priceUSD: 0.08,
        moq: 10000, stock: '', description: '食品级淋膜纸杯，8盎司，单层，可定制印刷',
        images: '', projectId: 'coffee-cups', createdAt: '', updatedAt: '' },
      { name: '12oz双层隔热杯', model: 'CC-12OZ-2P', category: '纸杯', unit: '只',
        costCNY: 0.35, costUSD: null, priceCNY: 0.58, priceUSD: 0.14,
        moq: 10000, stock: '', description: '双层瓦楞隔热，12盎司，无需杯套',
        images: '', projectId: 'coffee-cups', createdAt: '', updatedAt: '' },
      { name: '16oz加高拿铁杯', model: 'CC-16OZ-LATTE', category: '纸杯', unit: '只',
        costCNY: 0.42, costUSD: null, priceCNY: 0.72, priceUSD: 0.18,
        moq: 5000, stock: '', description: '16oz加高杯型，适合拿铁等大杯饮品，可定制',
        images: '', projectId: 'coffee-cups', createdAt: '', updatedAt: '' }
    ];

    this.saveLocalOnly('mate-cups', 'customers', mateCustomers);
    this.saveLocalOnly('mate-cups', 'products', mateProducts);
    this.saveLocalOnly('mate-cups', 'orders', mateOrders);
    this.saveLocalOnly('coffee-cups', 'customers', coffeeCustomers);
    this.saveLocalOnly('coffee-cups', 'products', coffeeProducts);
    this.saveLocalOnly('coffee-cups', 'orders', []);
  }
};
