/*******************************************************************************
 * VPS FINANCE - Loan Management & Agreement Generation System
 * Single-file Express.js & MongoDB Application
 *******************************************************************************/

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vps_finance';

// Middleware & Manual CORS Support (No external module needed)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ==========================================
// MONGODB SCHEMAS & MODELS
// ==========================================
const loanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobNo: { type: String, required: true },
    address: { type: String, required: true },
    loanAmount: { type: Number, required: true },
    confirmedAmount: { type: Number, default: 0 },
    interestRate: { type: Number, required: true }, // percentage
    returnDate: { type: String, required: true },
    upiId: { type: String, required: true },
    fileChargePaid: { type: Boolean, default: false },
    fileChargeTxnId: { type: String, default: '' },
    status: { type: String, enum: ['Pending Payment', 'Pending Admin Confirmation', 'Confirmed', 'Rejected'], default: 'Pending Payment' },
    createdAt: { type: Date, default: Date.now }
});

const Loan = mongoose.model('Loan', loanSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully'))
    .catch(err => console.error('MongoDB connection error:', err));


// ==========================================
// API ROUTES
// ==========================================

// 1. Submit New Loan Request (Initial Step)
app.post('/api/loans', async (req, res) => {
    try {
        const { name, mobNo, address, loanAmount, interestRate, returnDate, upiId } = req.body;
        const newLoan = new Loan({
            name,
            mobNo,
            address,
            loanAmount,
            interestRate,
            returnDate,
            upiId,
            status: 'Pending Payment'
        });
        await newLoan.save();
        res.status(201).json({ success: true, loanId: newLoan._id });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Submit File Charge Payment Proof (₹350)
app.post('/api/loans/:id/pay', async (req, res) => {
    try {
        const { txnId } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, error: 'Loan request not found' });

        loan.fileChargePaid = true;
        loan.fileChargeTxnId = txnId || 'UPI-DIRECT-PAY';
        loan.status = 'Pending Admin Confirmation';
        await loan.save();

        res.json({ success: true, message: 'Payment submitted successfully. Waiting for Admin confirmation.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Get Loan Status (Customer View)
app.get('/api/loans/:id', async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, error: 'Loan not found' });
        res.json({ success: true, loan });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Admin: Get All Loans
app.get('/api/admin/loans', async (req, res) => {
    try {
        const loans = await Loan.find().sort({ createdAt: -1 });
        res.json({ success: true, loans });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Admin: Confirm or Reject Loan & Set Confirmed Amount
app.post('/api/admin/loans/:id/action', async (req, res) => {
    try {
        const { action, confirmedAmount } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, error: 'Loan not found' });

        if (action === 'Confirm') {
            loan.status = 'Confirmed';
            loan.confirmedAmount = confirmedAmount || loan.loanAmount;
        } else if (action === 'Reject') {
            loan.status = 'Rejected';
        }
        await loan.save();
        res.json({ success: true, loan });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
// FRONTEND INTERFACE (HTML / CSS / JS)
// ==========================================
app.get('*', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Finance - Loan Distribution Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-between font-sans">

    <!-- Navbar -->
    <header class="bg-slate-800 border-b border-slate-700 shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div class="flex items-center space-x-3 cursor-pointer" onclick="switchTab('apply')">
                <div class="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl"><i class="fa-solid fa-vault"></i></div>
                <div>
                    <h1 class="text-xl font-bold tracking-wide text-blue-400">VPS FINANCE</h1>
                    <p class="text-xs text-slate-400">Secure Loan Distribution & Agreements</p>
                </div>
            </div>
            <nav class="space-x-4">
                <button onclick="switchTab('apply')" id="nav-apply" class="px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm transition">Apply Loan</button>
                <button onclick="switchTab('status')" id="nav-status" class="px-3 py-2 rounded-md hover:bg-slate-700 font-medium text-sm transition">Check Status</button>
                <button onclick="switchTab('admin')" id="nav-admin" class="px-3 py-2 rounded-md hover:bg-slate-700 font-medium text-sm transition text-amber-400"><i class="fa-solid fa-lock mr-1"></i> Admin Portal</button>
            </nav>
        </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-4xl w-full mx-auto px-4 py-8 flex-grow">

        <!-- TAB 1: APPLY LOAN -->
        <section id="tab-apply" class="space-y-6">
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
                <h2 class="text-2xl font-bold mb-2 text-blue-400"><i class="fa-solid fa-file-invoice-dollar mr-2"></i>Loan Application & Registration</h2>
                <p class="text-sm text-slate-400 mb-6">Fill in your details below. A one-time non-refundable file charge of <strong class="text-white">₹350/-</strong> is required to process your application.</p>
                
                <form id="loanForm" onsubmit="handleLoanSubmit(event)" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
                        <input type="text" id="name" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Enter your full name">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Mobile Number</label>
                        <input type="tel" id="mobNo" required pattern="[0-9]{10}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="10-digit mobile number">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Complete Address</label>
                        <textarea id="address" rows="2" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="House No, Street, City, State, Pincode"></textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Requested Loan Amount (₹)</label>
                        <input type="number" id="loanAmount" required min="1000" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. 50000">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Interest Rate (% p.a.)</label>
                        <input type="number" step="0.1" id="interestRate" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. 12">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Return Date</label>
                        <input type="date" id="returnDate" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Your UPI ID (For Disbursement)</label>
                        <input type="text" id="upiId" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="username@oksbi / paytm">
                    </div>
                    <div class="md:col-span-2 mt-4">
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center space-x-2">
                            <span>Proceed for Loan & File Charge Payment</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </form>
            </div>
        </section>

        <!-- TAB 1.5: PAYMENT MODAL / SECTION -->
        <section id="tab-payment" class="hidden space-y-6">
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl text-center max-w-xl mx-auto">
                <div class="bg-blue-600/20 text-blue-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    <i class="fa-solid fa-indian-rupee-sign"></i>
                </div>
                <h2 class="text-2xl font-bold mb-2">Pay File Charge (₹350/-)</h2>
                <p class="text-sm text-slate-400 mb-6">Scan the QR code below using any UPI app (GPay, PhonePe, Paytm) and enter transaction reference ID once paid.</p>
                
                <div class="bg-white p-4 rounded-xl inline-block mb-4 shadow">
                    <!-- UPI QR Code set to 9005041462@upi -->
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=9005041462@upi&pn=VPS%20Finance&am=350.00&cu=INR" alt="UPI QR Code" class="mx-auto rounded">
                    <p class="text-xs text-slate-800 font-mono mt-2 font-bold">UPI ID: 9005041462@upi</p>
                </div>

                <div class="mb-4 text-left">
                    <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Enter UPI Transaction ID / Reference No.</label>
                    <input type="text" id="txnId" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. UPI/234982347923">
                </div>

                <button onclick="submitPayment()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition">
                    I Have Paid ₹350/- - Submit for Verification
                </button>
            </div>
        </section>

        <!-- TAB 2: CHECK STATUS -->
        <section id="tab-status" class="hidden space-y-6">
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl max-w-xl mx-auto">
                <h2 class="text-2xl font-bold mb-2 text-blue-400"><i class="fa-solid fa-magnifying-glass mr-2"></i>Check Loan Status</h2>
                <p class="text-sm text-slate-400 mb-4">Enter your application ID received upon registration.</p>
                <div class="flex gap-2 mb-6">
                    <input type="text" id="searchLoanId" placeholder="Enter Application ID (e.g. 64a...)" class="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm">
                    <button onclick="fetchLoanStatus()" class="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-lg font-bold transition">Check</button>
                </div>

                <div id="statusResult" class="hidden bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-3">
                    <!-- Dynamic status info -->
                </div>
            </div>
        </section>

        <!-- TAB 3: ADMIN PORTAL -->
        <section id="tab-admin" class="hidden space-y-6">
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-amber-400"><i class="fa-solid fa-user-shield mr-2"></i>Admin Dashboard</h2>
                        <p class="text-sm text-slate-400">Review loan requests, confirm amounts, and manage user files.</p>
                    </div>
                    <button onclick="loadAdminLoans()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold transition"><i class="fa-solid fa-rotate mr-1"></i> Refresh</button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-slate-700 text-slate-400 uppercase text-xs">
                                <th class="p-3">Customer</th>
                                <th class="p-3">Req. Amt</th>
                                <th class="p-3">File Fee</th>
                                <th class="p-3">Status</th>
                                <th class="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="adminLoanTableBody" class="divide-y divide-slate-700">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- AGREEMENT VIEW MODAL -->
        <section id="tab-agreement" class="hidden space-y-6">
            <div class="bg-white text-slate-900 p-8 rounded-xl shadow-2xl max-w-3xl mx-auto print:shadow-none print:p-0">
                <div class="flex justify-between items-start border-b pb-4 mb-4">
                    <div>
                        <h1 class="text-2xl font-black text-blue-900">VPS FINANCE</h1>
                        <p class="text-xs text-slate-600">Authorized Loan Distribution & Agreement Portal</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase">Loan Agreement</span>
                        <p class="text-xs text-slate-500 mt-1" id="ag-date">Date: Oct 15, 2026</p>
                    </div>
                </div>

                <div class="space-y-4 text-sm leading-relaxed">
                    <p class="font-bold">LOAN AGREEMENT & PROMISSORY NOTE</p>
                    <p>This Loan Agreement ("Agreement") is entered into by and between <strong>VPS Finance</strong> ("Lender") and the borrower detailed below ("Borrower").</p>
                    
                    <div class="bg-slate-100 p-4 rounded-lg grid grid-cols-2 gap-2 text-xs">
                        <div><strong>Borrower Name:</strong> <span id="ag-name"></span></div>
                        <div><strong>Mobile No:</strong> <span id="ag-mob"></span></div>
                        <div class="col-span-2"><strong>Address:</strong> <span id="ag-address"></span></div>
                        <div><strong>Confirmed Loan Amount:</strong> ₹<span id="ag-amount" class="text-blue-700 font-bold text-base"></span></div>
                        <div><strong>Interest Rate:</strong> <span id="ag-interest"></span>% p.a.</div>
                        <div><strong>Repayment Date:</strong> <span id="ag-return"></span></div>
                        <div><strong>Disbursement UPI ID:</strong> <span id="ag-upi"></span></div>
                    </div>

                    <p><strong>1. Repayment Terms:</strong> The Borrower promises to pay back the Confirmed Loan Amount along with accrued interest to VPS Finance on or before the Return Date specified above.</p>
                    <p><strong>2. Default & Penalties:</strong> Failure to repay on the due date will attract legal action under applicable financial regulations and recovery proceedings.</p>
                    <p><strong>3. Acknowledgement:</strong> The Borrower acknowledges receipt of the loan amount disbursed via UPI to the provided ID and agrees to all terms.</p>

                    <div class="grid grid-cols-2 gap-8 pt-16 mt-8 border-t">
                        <div class="text-center">
                            <div class="h-16 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center pb-1">
                                <span class="text-xs text-slate-400 font-mono">[ Digital / Physical Signature ]</span>
                            </div>
                            <p class="font-bold text-xs" id="ag-sig-name">Borrower Signature</p>
                        </div>
                        <div class="text-center">
                            <div class="h-16 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center pb-1">
                                <span class="text-xs text-blue-600 font-bold">VPS Finance Auth. Signatory</span>
                            </div>
                            <p class="font-bold text-xs">For VPS Finance</p>
                        </div>
                    </div>
                </div>

                <div class="mt-8 flex justify-between print:hidden">
                    <button onclick="switchTab('status')" class="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-lg font-bold text-sm">Back to Status</button>
                    <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow"><i class="fa-solid fa-print mr-2"></i>Print / Download Agreement</button>
                </div>
            </div>
        </section>

    </main>

    <!-- Footer -->
    <footer class="bg-slate-800 border-t border-slate-700 text-center py-4 text-xs text-slate-400 mt-8">
        &copy; 2026 VPS Finance. All rights reserved. Secure Loan Distribution & Management.
    </footer>

    <!-- JavaScript Application Logic -->
    <script>
        let currentLoanId = null;

        function switchTab(tabId) {
            ['tab-apply', 'tab-payment', 'tab-status', 'tab-admin', 'tab-agreement'].forEach(id => {
                document.getElementById(id).classList.add('hidden');
            });
            document.getElementById('tab-' + tabId).classList.remove('hidden');

            ['nav-apply', 'nav-status', 'nav-admin'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.classList.remove('bg-blue-600', 'text-white');
            });
            if(['apply', 'status', 'admin'].includes(tabId)) {
                const el = document.getElementById('nav-' + tabId);
                if(el) el.classList.add('bg-blue-600', 'text-white');
            }

            if(tabId === 'admin') loadAdminLoans();
        }

        async function handleLoanSubmit(e) {
            e.preventDefault();
            const payload = {
                name: document.getElementById('name').value,
                mobNo: document.getElementById('mobNo').value,
                address: document.getElementById('address').value,
                loanAmount: Number(document.getElementById('loanAmount').value),
                interestRate: Number(document.getElementById('interestRate').value),
                returnDate: document.getElementById('returnDate').value,
                upiId: document.getElementById('upiId').value
            };

            try {
                const res = await fetch('/api/loans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    currentLoanId = data.loanId;
                    switchTab('payment');
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Network error while submitting application.');
            }
        }

        async function submitPayment() {
            const txnId = document.getElementById('txnId').value;
            if(!txnId) {
                alert('Please enter your UPI transaction reference ID.');
                return;
            }

            try {
                const res = await fetch(\`/api/loans/\${currentLoanId}/pay\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txnId })
                });
                const data = await res.json();
                if(data.success) {
                    alert('File charge submitted successfully! Your Application ID is: ' + currentLoanId);
                    document.getElementById('searchLoanId').value = currentLoanId;
                    switchTab('status');
                    fetchLoanStatus();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Network error submitting payment.');
            }
        }

        async function fetchLoanStatus() {
            const loanId = document.getElementById('searchLoanId').value.trim();
            if(!loanId) return alert('Please enter a Loan Application ID.');

            try {
                const res = await fetch(\`/api/loans/\${loanId}\`);
                const data = await res.json();
                const resultDiv = document.getElementById('statusResult');
                resultDiv.classList.remove('hidden');

                if(data.success) {
                    const l = data.loan;
                    let statusColor = 'text-amber-400';
                    if(l.status === 'Confirmed') statusColor = 'text-emerald-400';
                    if(l.status === 'Rejected') statusColor = 'text-rose-400';

                    resultDiv.innerHTML = \`
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-400 font-mono">ID: \${l._id}</span>
                            <span class="font-bold \${statusColor}">\${l.status}</span>
                        </div>
                        <hr class="border-slate-700">
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div><strong>Name:</strong> \${l.name}</div>
                            <div><strong>Mobile:</strong> \${l.mobNo}</div>
                            <div><strong>Req. Amount:</strong> ₹\${l.loanAmount}</div>
                            <div><strong>Confirmed Amount:</strong> ₹\${l.confirmedAmount || 'Pending'}</div>
                            <div><strong>File Fee:</strong> \${l.fileChargePaid ? 'Paid (₹350)' : 'Unpaid'}</div>
                            <div><strong>Return Date:</strong> \${l.returnDate}</div>
                        </div>
                        \${l.status === 'Confirmed' ? \`<button onclick="viewAgreement('\${l._id}')" class="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs"><i class="fa-solid fa-file-contract mr-1"></i> Download / View Agreement</button>\` : ''}
                    \`;
                } else {
                    resultDiv.innerHTML = \`<p class="text-rose-400 text-xs">Loan not found with ID provided.</p>\`;
                }
            } catch (err) {
                alert('Error fetching loan status.');
            }
        }

        async function loadAdminLoans() {
            try {
                const res = await fetch('/api/admin/loans');
                const data = await res.json();
                if(data.success) {
                    const tbody = document.getElementById('adminLoanTableBody');
                    tbody.innerHTML = '';
                    data.loans.forEach(l => {
                        tbody.innerHTML += \`
                            <tr class="hover:bg-slate-750 transition">
                                <td class="p-3">
                                    <div class="font-bold">\${l.name}</div>
                                    <div class="text-xs text-slate-400">\${l.mobNo} | UPI: \${l.upiId}</div>
                                    <div class="text-[10px] text-slate-500 font-mono">ID: \${l._id}</div>
                                </td>
                                <td class="p-3">₹\${l.loanAmount}<br><span class="text-xs text-slate-400">\${l.interestRate}% p.a.</span></td>
                                <td class="p-3">
                                    \${l.fileChargePaid ? '<span class="text-emerald-400 text-xs"><i class="fa-solid fa-circle-check"></i> Paid (₹350)</span>' : '<span class="text-amber-400 text-xs">Unpaid</span>'}
                                </td>
                                <td class="p-3">
                                    <span class="px-2 py-1 rounded text-xs font-semibold \${l.status === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-400' : l.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}">\${l.status}</span>
                                </td>
                                <td class="p-3 text-right space-x-1">
                                    <div class="inline-flex flex-col gap-1 items-end">
                                        <div class="flex gap-1">
                                            <input type="number" id="confAmt-\${l._id}" value="\${l.confirmedAmount || l.loanAmount}" class="w-24 bg-slate-900 border border-slate-700 px-2 py-1 text-xs rounded text-white" placeholder="Conf. Amt">
                                        </div>
                                        <div class="flex gap-1">
                                            <button onclick="adminAction('\${l._id}', 'Confirm')" class="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded text-xs font-bold text-white">Confirm</button>
                                            <button onclick="adminAction('\${l._id}', 'Reject')" class="bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded text-xs font-bold text-white">Reject</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        \`;
                    });
                }
            } catch (err) {
                console.error('Error loading admin loans:', err);
            }
        }

        async function adminAction(loanId, action) {
            const confirmedAmount = Number(document.getElementById(\`confAmt-\${loanId}\`).value);
            try {
                const res = await fetch(\`/api/admin/loans/\${loanId}/action\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, confirmedAmount })
                });
                const data = await res.json();
                if(data.success) {
                    loadAdminLoans();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Error updating loan status.');
            }
        }

        async function viewAgreement(loanId) {
            try {
                const res = await fetch(\`/api/loans/\${loanId}\`);
                const data = await res.json();
                if(data.success) {
                    const l = data.loan;
                    document.getElementById('ag-name').innerText = l.name;
                    document.getElementById('ag-mob').innerText = l.mobNo;
                    document.getElementById('ag-address').innerText = l.address;
                    document.getElementById('ag-amount').innerText = l.confirmedAmount || l.loanAmount;
                    document.getElementById('ag-interest').innerText = l.interestRate;
                    document.getElementById('ag-return').innerText = l.returnDate;
                    document.getElementById('ag-upi').innerText = l.upiId;
                    document.getElementById('ag-sig-name').innerText = l.name + ' (Borrower)';
                    document.getElementById('ag-date').innerText = 'Date: ' + new Date(l.createdAt).toLocaleDateString();
                    
                    switchTab('agreement');
                }
            } catch (err) {
                alert('Error loading agreement details.');
            }
        }
    </script>
</body>
</html>
    `);
});

// Start Server
app.listen(PORT, () => {
    console.log(`VPS Finance server running on port ${PORT}`);
});
