/**
 * LeLe Finance - Powered by CareerBoot
 * Single-file Express Application for Loan Management & Agreement Generation
 */

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lele-finance';

// ==================== DATABASE CONNECTION ====================
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// ==================== SCHEMAS & MODELS ====================
const userSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  address: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const loanSchema = new mongoose.Schema({
  clientMobile: { type: String, required: true },
  clientName: { type: String, required: true },
  address: { type: String, required: true },
  aadharFileName: { type: String, required: true },
  panFileName: { type: String, required: true },
  guarantorMobile: { type: String, required: true },
  requestAmount: { type: Number, required: true },
  returnDate: { type: String, required: true },
  signature: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Loan = mongoose.model('Loan', loanSchema);

// ==================== MIDDLEWARE ====================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'lele-finance-careerboot-super-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day session
}));

// ==================== UI TEMPLATE HELPER ====================
function renderLayout(title, content) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | LeLe Finance</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              glassDark: 'rgba(17, 24, 39, 0.7)',
              glassBorder: 'rgba(255, 255, 255, 0.1)',
            }
          }
        }
      }
    </script>
    <style>
      .glass {
        background: rgba(30, 41, 59, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .glass-input {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .glass-input:focus {
        border-color: #38bdf8;
        outline: none;
        box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
      }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
    <!-- Header -->
    <header class="glass sticky top-0 z-50 border-b border-slate-800">
        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <a href="/" class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/30">LF</div>
                <div>
                    <h1 class="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">LeLe Finance</h1>
                    <p class="text-xs text-slate-400 tracking-widest uppercase">Powered by CareerBoot</p>
                </div>
            </a>
            <div class="flex items-center space-x-4">
                <a href="/financer-login" class="text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500 transition shadow-sm">Financer Portal</a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-6 py-10 w-full flex-grow">
        ${content}
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        &copy; 2026 LeLe Finance &bull; CareerBoot & Skills Development, Lucknow. All rights reserved.
    </footer>
</body>
</html>`;
}

// ==================== ROUTES ====================

// 1. Home / Login & Registration via Mobile
app.get('/', async (req, res) => {
  if (req.session.clientMobile) {
    return res.redirect('/dashboard');
  }

  const content = `
    <div class="max-w-md mx-auto glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div class="absolute -right-16 -top-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">Welcome Client</h2>
            <p class="text-sm text-slate-400">Enter your mobile number to sign in or register instantly.</p>
        </div>
        <form action="/login" method="POST" class="space-y-6">
            <div>
                <label class="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">Mobile Number</label>
                <input type="tel5" name="mobile" required pattern="[0-9]{10}" placeholder="e.g. 9876543210" class="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-slate-600 transition" />
                <p class="text-[11px] text-slate-500 mt-1">One mobile number = One unique account.</p>
            </div>
            <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] transition transform active:scale-[0.99]">
                Continue to Portal &rarr;
            </button>
        </form>
    </div>
  `;
  res.send(renderLayout('Client Access', content));
});

app.post('/login', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || mobile.length < 10) return res.redirect('/');

  let user = await User.findOne({ mobile });
  if (!user) {
    user = await User.create({ mobile });
  }

  req.session.clientMobile = mobile;
  res.redirect('/dashboard');
});

// 2. Client Dashboard
app.get('/dashboard', async (req, res) => {
  if (!req.session.clientMobile) return res.redirect('/');

  const user = await User.findOne({ mobile: req.session.clientMobile });
  const existingLoan = await Loan.findOne({ clientMobile: req.session.clientMobile }).sort({ createdAt: -1 });

  let loanActiveOrPending = existingLoan && (existingLoan.status === 'Pending' || existingLoan.status === 'Approved');

  let loanStatusHtml = '';
  if (!existingLoan) {
    loanStatusHtml = `<p class="text-slate-400 text-sm">You have no active or past loan applications.</p>`;
  } else {
    const badgeColor = existingLoan.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                       existingLoan.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                       'bg-amber-500/10 text-amber-400 border-amber-500/30';
    
    loanStatusHtml = `
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div>
            <p class="text-xs text-slate-400">Requested Amount</p>
            <p class="text-lg font-bold text-white">₹${existingLoan.requestAmount}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">Return Date</p>
            <p class="text-sm font-semibold text-slate-200">${existingLoan.returnDate}</p>
          </div>
          <div>
            <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${existingLoan.status}</span>
          </div>
        </div>
        ${existingLoan.status === 'Approved' ? `
          <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <p class="font-semibold text-emerald-400 text-sm">Loan Approved!</p>
              <p class="text-xs text-emerald-300/80">Download your official loan agreement PDF below.</p>
            </div>
            <a href="/download-agreement/${existingLoan._id}" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md">Download PDF Agreement</a>
          </div>
        ` : ''}
        ${existingLoan.status === 'Rejected' ? `
          <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p class="text-xs text-rose-400">Your previous loan application was rejected by the financer. You may submit a new request once your record clears.</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  let formHtml = '';
  if (loanActiveOrPending) {
    formHtml = `
      <div class="p-6 rounded-2xl glass border border-amber-500/20 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 font-bold text-lg">!</div>
        <h3 class="text-lg font-bold text-white">Active Loan Notice</h3>
        <p class="text-sm text-slate-400">No new loan eligibility while a loan is ongoing or pending review.</p>
      </div>
    `;
  } else {
    formHtml = `
      <form action="/apply-loan" method="POST" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Full Name</label>
            <input type="text" name="clientName" required placeholder="Enter your full name" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Guarantor Mobile Number</label>
            <input type="tel" name="guarantorMobile" required pattern="[0-9]{10}" placeholder="Guarantor mobile" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Complete Residential Address</label>
          <textarea name="address" rows="2" required placeholder="House no, Street, City, Pincode" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"></textarea>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Aadhar PDF Upload (Filename)</label>
            <input type="text" name="aadharFileName" required placeholder="e.g. aadhar_card.pdf" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">PAN PDF Upload (Filename)</label>
            <input type="text" name="panFileName" required placeholder="e.g. pan_card.pdf" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Requested Loan Amount (₹)</label>
            <input type="number" name="requestAmount" min="1000" max="500000" required placeholder="e.g. 25000" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Target Return Date</label>
            <input type="date" name="returnDate" required class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Digital Signature (Type your Full Name)</label>
          <input type="text" name="signature" required placeholder="Sign digitally with your name" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm italic font-serif" />
        </div>
        <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition">
          Submit Loan Request
        </button>
      </form>
    `;
  }

  const content = `
    <div class="space-y-8">
      <div class="glass p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span class="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Client Dashboard</span>
          <h2 class="text-2xl font-bold text-white mt-1">Mobile: ${user.mobile}</h2>
        </div>
        <a href="/logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition">Logout</a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1 glass p-6 rounded-3xl space-y-4">
          <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">Loan Status</h3>
          ${loanStatusHtml}
        </div>

        <div class="lg:col-span-2 glass p-6 rounded-3xl space-y-6">
          <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">Request New Loan</h3>
          ${formHtml}
        </div>
      </div>
    </div>
  `;
  res.send(renderLayout('Dashboard', content));
});

app.post('/apply-loan', async (req, res) => {
  if (!req.session.clientMobile) return res.redirect('/');

  const { clientName, address, aadharFileName, panFileName, guarantorMobile, requestAmount, returnDate, signature } = req.body;

  // Check ongoing loan guard
  const existingLoan = await Loan.findOne({ clientMobile: req.session.clientMobile, status: { $in: ['Pending', 'Approved'] } });
  if (existingLoan) return res.redirect('/dashboard');

  await Loan.create({
    clientMobile: req.session.clientMobile,
    clientName,
    address,
    aadharFileName,
    panFileName,
    guarantorMobile,
    requestAmount,
    returnDate,
    signature,
    status: 'Pending'
  });

  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 3. Financer Portal & Authentication
app.get('/financer-login', (req, res) => {
  const content = `
    <div class="max-w-md mx-auto glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">Financer Access</h2>
            <p class="text-sm text-slate-400">Enter the secret passcode to unlock client loan requests.</p>
        </div>
        <form action="/financer-auth" method="POST" class="space-y-6">
            <div>
                <label class="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">Passcode</label>
                <input type="password" name="code" required placeholder="Enter passcode" class="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-slate-600 transition" />
            </div>
            <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition">
                Unlock Dashboard &rarr;
            </button>
        </form>
    </div>
  `;
  res.send(renderLayout('Financer Login', content));
});

app.post('/financer-auth', (req, res) => {
  const { code } = req.body;
  if (code === 'Paisa25') {
    req.session.isFinancer = true;
    return res.redirect('/financer-dashboard');
  }
  res.redirect('/financer-login');
});

app.get('/financer-dashboard', async (req, res) => {
  if (!req.session.isFinancer) return res.redirect('/financer-login');

  const loans = await Loan.find({}).sort({ createdAt: -1 });

  let rowsHtml = loans.map(loan => {
    const badgeColor = loan.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                       loan.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                       'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return `
      <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition">
        <td class="py-4 px-4">
          <p class="font-bold text-white">${loan.clientName}</p>
          <p class="text-xs text-slate-400">M: ${loan.clientMobile}</p>
          <p class="text-xs text-slate-500">Guarantor: ${loan.guarantorMobile}</p>
        </td>
        <td class="py-4 px-4">
          <p class="text-emerald-400 font-bold text-base">₹${loan.requestAmount}</p>
          <p class="text-xs text-slate-400">Return: ${loan.returnDate}</p>
        </td>
        <td class="py-4 px-4 text-xs text-slate-300">
          <p>Address: ${loan.address}</p>
          <p class="text-cyan-400">Aadhar: ${loan.aadharFileName} | PAN: ${loan.panFileName}</p>
        </td>
        <td class="py-4 px-4 text-xs font-serif italic text-slate-300">${loan.signature}</td>
        <td class="py-4 px-4">
          <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${loan.status}</span>
        </td>
        <td class="py-4 px-4 space-y-2">
          ${loan.status === 'Pending' ? `
            <div class="flex space-x-2">
              <form action="/update-loan/${loan._id}/Approved" method="POST"><button class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold">Approve</button></form>
              <form action="/update-loan/${loan._id}/Rejected" method="POST"><button class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold">Reject</button></form>
            </div>
          ` : ''}
          ${loan.status === 'Approved' ? `
            <a href="/download-agreement/${loan._id}" class="inline-block px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold border border-slate-700">Agreement PDF</a>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <div class="space-y-6">
      <div class="glass p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span class="text-xs uppercase tracking-widest text-emerald-400 font-semibold">Financer Portal</span>
          <h2 class="text-2xl font-bold text-white mt-1">All Client Loan Applications</h2>
        </div>
        <a href="/financer-logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition">Lock Financer Portal</a>
      </div>

      <div class="glass rounded-3xl overflow-hidden shadow-xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400 uppercase tracking-wider">
                <th class="py-4 px-4">Client Details</th>
                <th class="py-4 px-4">Loan Amount</th>
                <th class="py-4 px-4">Documents & Address</th>
                <th class="py-4 px-4">Signature</th>
                <th class="py-4 px-4">Status</th>
                <th class="py-4 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="6" class="text-center py-8 text-slate-500 text-sm">No loan requests found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  res.send(renderLayout('Financer Dashboard', content));
});

app.post('/update-loan/:id/:status', async (req, res) => {
  if (!req.session.isFinancer) return res.redirect('/financer-login');
  const { id, status } = req.params;
  if (['Approved', 'Rejected'].includes(status)) {
    await Loan.findByIdAndUpdate(id, { status });
  }
  res.redirect('/financer-dashboard');
});

app.get('/financer-logout', (req, res) => {
  req.session.isFinancer = false;
  res.redirect('/');
});

// 4. Automated Agreement PDF Generation Route
app.get('/download-agreement/:id', async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan || loan.status !== 'Approved') {
    return res.status(403).send('Unauthorized or loan not approved.');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Loan_Agreement_${loan.clientName.replace(/\s+/g, '_')}.pdf`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // PDF Styling & Content
  doc.fontSize(20).fillColor('#0284c7').text('LELE FINANCE', { align: 'center' });
  doc.fontSize(10).fillColor('#64748b').text('Powered by CareerBoot & Skills Development, Lucknow', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(14).fillColor('#0f172a').text('OFFICIAL LOAN AGREEMENT', { align: 'underline' });
  doc.moveDown(1);

  doc.fontSize(10).fillColor('#334155').text(`This agreement is made and executed on this day between LeLe Finance (Financer) and the Borrower detailed below:` );
  doc.moveDown(1);

  doc.fontSize(11).fillColor('#0f172a').text('Borrower Details:');
  doc.fontSize(10).fillColor('#334155')
     .text(`- Full Name: ${loan.clientName}`)
     .text(`- Mobile Number: ${loan.clientMobile}`)
     .text(`- Residential Address: ${loan.address}`)
     .text(`- Guarantor Mobile: ${loan.guarantorMobile}`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor('#0f172a').text('Loan Sanction Details:');
  doc.fontSize(10).fillColor('#334155')
     .text(`- Approved Loan Amount: Rs. ${loan.requestAmount}/-`)
     .text(`- Target Repayment Date: ${loan.returnDate}`)
     .text(`- Verification Docs: Aadhar (${loan.aadharFileName}), PAN (${loan.panFileName})`);
  doc.moveDown(2);

  doc.fontSize(10).fillColor('#334155').text('Terms & Conditions:', { underline: true });
  doc.fontSize(9).text('1. The borrower agrees to repay the full loan amount on or before the specified return date.');
  doc.text('2. Failure to repay on time will attract standard late fees and legal verification through guarantor contact.');
  doc.text('3. All disputes are subject to Lucknow jurisdiction.');
  doc.moveDown(3);

  doc.fontSize(10).fillColor('#0f172a').text(`Digital Signature of Borrower:`, { continued: true });
  doc.font('Times-Italic').text(`  ${loan.signature}`);

  doc.end();
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`LeLe Finance server running on port ${PORT}`);
});
