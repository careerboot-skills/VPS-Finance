const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vps_finance';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Customer Schema & Model
const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  panNumber: { type: String, required: true },
  aadhaarNumber: { type: String, required: true },
  loanAmountRequested: { type: Number, required: true },
  loanType: { type: String, required: true },
  monthlyIncome: { type: Number, required: true },
  address: { type: String, required: true },
  fileCharge: { type: Number, default: 350, required: true },
  paymentStatus: { type: String, default: 'Paid (Cash/Online)' },
  registrationDate: { type: Date, default: Date.now }
});

const Customer = mongoose.model('Customer', customerSchema);

// HTML Frontend Template
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Finance - Loan Registration & File Charge Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-50 text-slate-800 font-sans antialiased min-h-screen flex flex-col justify-between">

    <!-- Header / Navbar -->
    <header class="bg-blue-900 text-white shadow-md sticky top-0 z-50">
        <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center space-x-3">
                <div class="bg-amber-500 text-blue-950 p-2.5 rounded-lg font-black text-xl tracking-wider shadow">
                    <i class="fa-solid fa-vault"></i> VPS
                </div>
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">VPS Finance</h1>
                    <p class="text-xs text-blue-200">Instant Loan Distribution & Advisory Services</p>
                </div>
            </div>
            <nav class="flex items-center space-x-2 bg-blue-950/60 p-1 rounded-lg border border-blue-800">
                <button onclick="switchTab('register')" id="nav-register" class="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-blue-950 shadow transition">
                    <i class="fa-solid fa-user-plus mr-1.5"></i> Register Customer
                </button>
                <button onclick="switchTab('admin')" id="nav-admin" class="px-4 py-2 text-sm font-medium rounded-md text-blue-200 hover:text-white transition">
                    <i class="fa-solid fa-gauge-high mr-1.5"></i> Admin Dashboard
                </button>
            </nav>
        </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-4xl mx-auto px-4 py-8 flex-grow w-full">

        <!-- TAB 1: REGISTRATION FORM -->
        <section id="tab-register" class="space-y-6">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-5 text-white flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold">New Customer Registration</h2>
                        <p class="text-xs text-blue-200 mt-0.5">Please fill in accurate details and pay the one-time file charge of ₹350</p>
                    </div>
                    <span class="bg-amber-500 text-blue-950 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow">
                        File Fee: ₹350
                    </span>
                </div>

                <form id="registrationForm" onsubmit="handleRegistration(event)" class="p-6 sm:p-8 space-y-6">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <!-- Full Name -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Full Name (As per PAN)</label>
                            <input type="text" name="fullName" required placeholder="e.g. Rahul Sharma"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- Phone Number -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Mobile Number</label>
                            <input type="tel" name="phone" required pattern="[0-9]{10}" placeholder="10-digit mobile number"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- Email -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                            <input type="email" name="email" placeholder="rahul@example.com"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- PAN Number -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">PAN Card Number</label>
                            <input type="text" name="panNumber" required placeholder="ABCDE1234F" style="text-transform:uppercase"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- Aadhaar Number -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Aadhaar Number</label>
                            <input type="text" name="aadhaarNumber" required pattern="[0-9]{12}" placeholder="12-digit Aadhaar number"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- Loan Type -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Loan Category</label>
                            <select name="loanType" required
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm bg-white">
                                <option value="">Select Loan Type</option>
                                <option value="Personal Loan">Personal Loan</option>
                                <option value="Business Loan">Business Loan</option>
                                <option value="Home Loan">Home Loan</option>
                                <option value="Car / Auto Loan">Car / Auto Loan</option>
                                <option value="Microfinance / Group Loan">Microfinance / Group Loan</option>
                            </select>
                        </div>

                        <!-- Loan Amount Requested -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Loan Amount Requested (₹)</label>
                            <input type="number" name="loanAmountRequested" required min="10000" placeholder="e.g. 200000"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>

                        <!-- Monthly Income -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Monthly Income (₹)</label>
                            <input type="number" name="monthlyIncome" required min="5000" placeholder="e.g. 35000"
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm">
                        </div>
                    </div>

                    <!-- Address -->
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 mb-1">Residential Address</label>
                        <textarea name="address" rows="2" required placeholder="House No, Street, Landmark, City, State, Pincode"
                            class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm"></textarea>
                    </div>

                    <!-- File Charge Confirmation Box -->
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div class="flex items-center space-x-3">
                            <div class="bg-amber-500 text-white p-3 rounded-lg text-lg">
                                <i class="fa-solid fa-receipt"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-amber-900 text-sm">Mandatory File Processing Charge</h4>
                                <p class="text-xs text-amber-700">One-time processing fee for file creation & verification.</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-2xl font-black text-amber-900">₹350</span>
                            <span class="block text-[10px] text-amber-700 uppercase font-semibold">Non-refundable</span>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" id="submitBtn"
                        class="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow transition flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-check-circle"></i>
                        <span>Confirm Registration & Collect ₹350 File Fee</span>
                    </button>
                </form>
            </div>

            <!-- Success Receipt Modal Card (Hidden initially) -->
            <div id="successCard" class="hidden bg-white rounded-xl shadow-md border border-emerald-200 p-8 space-y-6">
                <div class="text-center space-y-2">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-emerald-900">Registration Successful!</h3>
                    <p class="text-sm text-slate-600">Customer file has been created and registered successfully in VPS Finance database.</p>
                </div>

                <div id="receiptDetails" class="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-3 text-sm">
                    <!-- Populated via JavaScript -->
                </div>

                <div class="flex gap-4">
                    <button onclick="window.print()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg text-sm transition">
                        <i class="fa-solid fa-print mr-1.5"></i> Print Receipt
                    </button>
                    <button onclick="resetForm()" class="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg text-sm transition">
                        <i class="fa-solid fa-user-plus mr-1.5"></i> Register Another
                    </button>
                </div>
            </div>
        </section>

        <!-- TAB 2: ADMIN DASHBOARD -->
        <section id="tab-admin" class="hidden space-y-6">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 class="text-xl font-bold text-slate-900">Admin Control Panel</h2>
                    <p class="text-xs text-slate-500">Monitor all registered loan files and total file fee collections.</p>
                </div>
                <div class="flex items-center gap-3">
                    <div class="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg text-center">
                        <span class="block text-xs text-blue-600 font-semibold uppercase">Total Files</span>
                        <span id="statTotalCount" class="text-xl font-bold text-blue-900">0</span>
                    </div>
                    <div class="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-center">
                        <span class="block text-xs text-emerald-600 font-semibold uppercase">Total Fee Collected</span>
                        <span id="statTotalRevenue" class="text-xl font-bold text-emerald-950">₹0</span>
                    </div>
                </div>
            </div>

            <!-- Customer Table -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">Registered Customer Files</h3>
                    <button onclick="loadAdminData()" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <i class="fa-solid fa-rotate mr-1"></i> Refresh List
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                                <th class="py-3 px-4">Date</th>
                                <th class="py-3 px-4">Customer Name</th>
                                <th class="py-3 px-4">Phone</th>
                                <th class="py-3 px-4">Loan Type</th>
                                <th class="py-3 px-4">Requested Amt</th>
                                <th class="py-3 px-4">File Fee</th>
                            </tr>
                        </thead>
                        <tbody id="customerTableBody" class="divide-y divide-slate-100">
                            <tr>
                                <td colspan="6" class="text-center py-6 text-slate-400">Loading customer records...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

    </main>

    <!-- Footer -->
    <footer class="bg-slate-900 text-slate-400 text-xs py-6 mt-12 border-t border-slate-800 text-center">
        <div class="max-w-6xl mx-auto px-4 space-y-1">
            <p class="font-semibold text-slate-300">VPS Finance & Loan Distribution Services</p>
            <p>&copy; ${new Date().getFullYear()} VPS Finance. All rights reserved.</p>
        </div>
    </footer>

    <!-- Frontend Script -->
    <script>
        function switchTab(tab) {
            const regTab = document.getElementById('tab-register');
            const adminTab = document.getElementById('tab-admin');
            const btnReg = document.getElementById('nav-register');
            const btnAdmin = document.getElementById('nav-admin');

            if (tab === 'register') {
                regTab.classList.remove('hidden');
                adminTab.classList.add('hidden');
                btnReg.className = 'px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-blue-950 shadow transition';
                btnAdmin.className = 'px-4 py-2 text-sm font-medium rounded-md text-blue-200 hover:text-white transition';
            } else {
                regTab.classList.add('hidden');
                adminTab.classList.remove('hidden');
                btnAdmin.className = 'px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-blue-950 shadow transition';
                btnReg.className = 'px-4 py-2 text-sm font-medium rounded-md text-blue-200 hover:text-white transition';
                loadAdminData();
            }
        }

        async function handleRegistration(e) {
            e.preventDefault();
            const form = document.getElementById('registrationForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing Registration...';

            try {
                const response = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (response.ok) {
                    form.reset();
                    form.parentElement.classList.add('hidden');
                    
                    const successCard = document.getElementById('successCard');
                    successCard.classList.remove('hidden');

                    const detailsDiv = document.getElementById('receiptDetails');
                    detailsDiv.innerHTML = \`
                        <div class="flex justify-between border-b border-slate-200 pb-2">
                            <span class="text-slate-500">File Reference ID:</span>
                            <span class="font-bold text-slate-900">\${result.customer._id}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-200 pb-2">
                            <span class="text-slate-500">Customer Name:</span>
                            <span class="font-bold text-slate-900">\${result.customer.fullName}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-200 pb-2">
                            <span class="text-slate-500">Mobile Number:</span>
                            <span class="font-bold text-slate-900">\${result.customer.phone}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-200 pb-2">
                            <span class="text-slate-500">Loan Type:</span>
                            <span class="font-bold text-slate-900">\${result.customer.loanType}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-200 pb-2">
                            <span class="text-slate-500">Requested Amount:</span>
                            <span class="font-bold text-slate-900">₹\${Number(result.customer.loanAmountRequested).toLocaleString('en-IN')}</span>
                        </div>
                        <div class="flex justify-between items-center pt-1">
                            <span class="font-bold text-emerald-800">File Charge Collected:</span>
                            <span class="bg-emerald-100 text-emerald-800 font-black px-3 py-1 rounded-full text-xs">₹350 (Paid)</span>
                        </div>
                    \`;
                } else {
                    alert('Error: ' + (result.error || 'Failed to register customer'));
                }
            } catch (err) {
                console.error(err);
                alert('Network or server error occurred.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-check-circle mr-2"></i> Confirm Registration & Collect ₹350 File Fee';
            }
        }

        function resetForm() {
            document.getElementById('successCard').classList.add('hidden');
            document.getElementById('registrationForm').parentElement.classList.remove('hidden');
        }

        async function loadAdminData() {
            try {
                const res = await fetch('/api/customers');
                const customers = await res.json();

                const tbody = document.getElementById('customerTableBody');
                const totalCount = document.getElementById('statTotalCount');
                const totalRevenue = document.getElementById('statTotalRevenue');

                totalCount.innerText = customers.length;
                const revenue = customers.length * 350;
                totalRevenue.innerText = '₹' + revenue.toLocaleString('en-IN');

                if (customers.length === 0) {
                    tbody.innerHTML = \`<tr><td colspan="6" class="text-center py-6 text-slate-400">No customer registrations found.</td></tr>\`;
                    return;
                }

                tbody.innerHTML = customers.map(c => \`
                    <tr class="hover:bg-slate-50 transition">
                        <td class="py-3 px-4 text-slate-500">\${new Date(c.registrationDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                        <td class="py-3 px-4 font-semibold text-slate-800">\${c.fullName}</td>
                        <td class="py-3 px-4 text-slate-600">\${c.phone}</td>
                        <td class="py-3 px-4"><span class="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-medium">\${c.loanType}</span></td>
                        <td class="py-3 px-4 font-medium text-slate-900">₹\${Number(c.loanAmountRequested).toLocaleString('en-IN')}</td>
                        <td class="py-3 px-4"><span class="bg-emerald-100 text-emerald-800 font-bold text-xs px-2 py-0.5 rounded">₹350 Paid</span></td>
                    </tr>
                \`).join('');
            } catch (err) {
                console.error(err);
                document.getElementById('customerTableBody').innerHTML = \`<tr><td colspan="6" class="text-center py-6 text-rose-500">Failed to load data from server.</td></tr>\`;
            }
        }
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
  res.send(htmlTemplate);
});

// API: Register Customer
app.post('/api/customers', async (req, res) => {
  try {
    const {
      fullName,
      phone,
      email,
      panNumber,
      aadhaarNumber,
      loanAmountRequested,
      loanType,
      monthlyIncome,
      address
    } = req.body;

    const newCustomer = new Customer({
      fullName,
      phone,
      email,
      panNumber: panNumber.toUpperCase(),
      aadhaarNumber,
      loanAmountRequested,
      loanType,
      monthlyIncome,
      address,
      fileCharge: 350
    });

    const savedCustomer = await newCustomer.save();
    res.status(201).json({ message: 'Customer registered successfully', customer: savedCustomer });
  } catch (error) {
    console.error('Error saving customer:', error);
    res.status(500).json({ error: error.message || 'Server error while saving customer' });
  }
});

// API: Get All Customers (Admin)
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ registrationDate: -1 });
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Server error while fetching customers' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`VPS Finance server is running on port ${PORT}`);
});
