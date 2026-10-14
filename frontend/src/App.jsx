
import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000';

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data);

      // Refresh ചെയ്താൽ selected order-ഉം update ചെയ്യുക
      setSelectedOrder((current) => {
        if (!current) return null;
        return response.data.find((o) => o.id === current.id) || null;
      });
    } catch (err) {
      console.error('Fetch orders error:', err);
      setError('Orders load ചെയ്യാൻ കഴിഞ്ഞില്ല. Backend പരിശോധിക്കുക.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      (order.orderNumber || '').toLowerCase().includes(query) ||
      (order.customerName || '').toLowerCase().includes(query) ||
      (order.customerEmail || '').toLowerCase().includes(query);

    const matchesPayment =
      paymentFilter === 'all' ||
      (order.financialStatus || '').toLowerCase() === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.totalPrice || 0),
    0,
  );

  const currency = orders[0]?.currency || 'USD';

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">SHOPIFY INTEGRATION</p>
          <h1>Order Management CRM</h1>
          <p className="subtitle">
            Manage and track your Shopify orders.
          </p>
        </div>

        <button onClick={fetchOrders} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Orders'}
        </button>
      </header>

      <section className="stats">
        <div className="stat-card">
          <span>Total Orders</span>
          <strong>{orders.length}</strong>
        </div>

        <div className="stat-card">
          <span>Total Revenue</span>
          <strong>
            {totalRevenue.toLocaleString('en-US', {
              style: 'currency',
              currency,
            })}
          </strong>
        </div>
      </section>

      <section className="orders-section">
        <h2>Recent Orders</h2>

        <div className="filters">
          <input
            type="text"
            placeholder="Search order, customer or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="refunded">Refunded</option>
            <option value="voided">Voided</option>
          </select>
        </div>

        {loading && <p>Loading orders...</p>}

        {!loading && error && <p className="error">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <p>No orders found. Sync Shopify orders first.</p>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <p className="results-count">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>

            {filteredOrders.length === 0 ? (
              <p>No orders match your search or payment filter.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Fulfillment</th>
                      <th>Items</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="clickable-row"
                        title="Click to view order details"
                      >
                        <td>{order.orderNumber || order.shopifyOrderId}</td>

                        <td>
                          <div>{order.customerName || 'Guest customer'}</div>
                          {order.customerEmail && (
                            <small>{order.customerEmail}</small>
                          )}
                        </td>

                        <td>
                          {order.currency}{' '}
                          {Number(order.totalPrice).toFixed(2)}
                        </td>

                        <td>
                          <span className="status">
                            {order.financialStatus || 'Unknown'}
                          </span>
                        </td>

                        <td>{order.fulfillmentStatus || 'Unfulfilled'}</td>

                        <td>{order.items?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {selectedOrder && (
        <section className="order-details">
          <div className="details-header">
            <div>
              <p className="eyebrow">ORDER DETAILS</p>
              <h2>{selectedOrder.orderNumber || selectedOrder.shopifyOrderId}</h2>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="close-button"
            >
              Close Details
            </button>
          </div>

          <div className="details-grid">
            <div>
              <span>Customer</span>
              <strong>{selectedOrder.customerName || 'Guest customer'}</strong>
            </div>

            <div>
              <span>Email</span>
              <strong>{selectedOrder.customerEmail || 'Not available'}</strong>
            </div>

            <div>
              <span>Total</span>
              <strong>
                {selectedOrder.currency}{' '}
                {Number(selectedOrder.totalPrice).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Payment status</span>
              <strong>{selectedOrder.financialStatus || 'Unknown'}</strong>
            </div>

            <div>
              <span>Fulfillment status</span>
              <strong>
                {selectedOrder.fulfillmentStatus || 'Unfulfilled'}
              </strong>
            </div>

            <div>
              <span>Created</span>
              <strong>
                {new Date(selectedOrder.createdAt).toLocaleString()}
              </strong>
            </div>
          </div>

          <h3>Products</h3>

          {selectedOrder.items?.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {selectedOrder.currency}{' '}
                        {Number(item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No products available for this order.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
