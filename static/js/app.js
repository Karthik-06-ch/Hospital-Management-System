// ══ API helper ════════════════════════════════════════════════════
const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
// If server returns 403 (blacklisted) force logout
API.interceptors.response.use(r => r, err => {
  if (err.response?.status === 403 && err.response?.data?.message?.includes('blacklisted')) {
    localStorage.clear();
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

// ══ Toast ══════════════════════════════════════════════════════════
const toastBus = (() => {
  const toasts = Vue.ref([]);
  const show = (msg, type = 'info', ms = 3800) => {
    const id = Date.now();
    toasts.value.push({ id, msg, type });
    setTimeout(() => toasts.value = toasts.value.filter(t => t.id !== id), ms);
  };
  return { toasts, show };
})();
window.$toast = toastBus.show;

// ══ Helpers ═══════════════════════════════════════════════════════
const today  = () => new Date().toISOString().split('T')[0];
const next7  = () => Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return d.toISOString().split('T')[0]; });
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fmtDay  = d => new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});

const DEPT_ICONS = { 'Cardiology':'❤️','Neurology':'🧠','Orthopedics':'🦴','Pediatrics':'👶','Dermatology':'🧬','General Medicine':'🩺','Oncology':'🔬','Ophthalmology':'👁️','ENT':'👂','Gynecology':'🌸','default':'🏥' };
const deptIcon = n => DEPT_ICONS[n] || DEPT_ICONS.default;

// ══════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════════════
const LoginPage = {
  template: `
  <div class="auth-page">
    <div class="auth-bg-pattern"></div>
    <div class="auth-grid-overlay"></div>
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">⚕️</div>
        <h2>HMS Portal</h2>
        <p>Hospital Management System</p>
      </div>
      <div class="mb-3">
        <label class="form-label">Username</label>
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-person"></i></span>
          <input v-model="form.username" type="text" class="form-control" placeholder="Enter username" @keyup.enter="doLogin">
        </div>
      </div>
      <div class="mb-4">
        <label class="form-label">Password</label>
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-lock"></i></span>
          <input v-model="form.password" :type="showPwd?'text':'password'" class="form-control" placeholder="Password" @keyup.enter="doLogin">
          <button type="button" class="input-group-text" @click="showPwd=!showPwd"><i :class="showPwd?'bi bi-eye-slash':'bi bi-eye'"></i></button>
        </div>
      </div>
      <button class="btn-auth btn" @click="doLogin" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ loading ? 'Signing in…' : 'Sign In' }}
      </button>
      <div class="d-flex gap-2 mt-3 justify-content-center">
        <router-link to="/register" style="font-size:.875rem;color:#0d9488;font-weight:600">New Patient? Register</router-link>
        <span style="color:#e2e8f0">|</span>
        <router-link to="/register-doctor" style="font-size:.875rem;color:#0d9488;font-weight:600">Doctor? Register</router-link>
      </div>

    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const form   = Vue.ref({ username:'', password:'' });
    const loading = Vue.ref(false), showPwd = Vue.ref(false);
    const doLogin = async () => {
      loading.value = true;
      try {
        const { data } = await API.post('/login', form.value);
        localStorage.setItem('token',      data.token);
        localStorage.setItem('role',       data.role);
        localStorage.setItem('username',   data.username);
        localStorage.setItem('profile_id', data.profile_id || '');
        localStorage.setItem('roll_no',    data.roll_no || '');
        window.$toast('Welcome, ' + data.username + '! 👋', 'success');
        if      (data.role==='admin')  router.push('/admin/dashboard');
        else if (data.role==='doctor') router.push('/doctor/dashboard');
        else                           router.push('/patient/dashboard');
      } catch(e) {
        const msg = e.response?.data?.message || 'Login failed';
        window.$toast(msg, 'error');
      } finally { loading.value = false; }
    };
    return { form, loading, showPwd, doLogin };
  }
};

// ══════════════════════════════════════════════════════════════════
//  PATIENT REGISTER
// ══════════════════════════════════════════════════════════════════
const RegisterPage = {
  template: `
  <div class="auth-page">
    <div class="auth-bg-pattern"></div><div class="auth-grid-overlay"></div>
    <div class="auth-card" style="max-width:500px">
      <div class="auth-logo">
        <div class="auth-logo-icon">🧑‍⚕️</div>
        <h2>Patient Registration</h2>
        <p>Create your patient account</p>
      </div>
      <div class="row g-3">
        <div class="col-12"><label class="form-label">Full Name *</label><input v-model="form.name" class="form-control" placeholder="John Smith" required></div>
        <div class="col-md-6"><label class="form-label">Username *</label><input v-model="form.username" class="form-control" placeholder="john_smith" required></div>
        <div class="col-md-6"><label class="form-label">Email *</label><input v-model="form.email" type="email" class="form-control" placeholder="john@email.com" required></div>
        <div class="col-md-6"><label class="form-label">Password *</label><input v-model="form.password" type="password" class="form-control" placeholder="••••••••" required></div>
        <div class="col-md-6"><label class="form-label">Date of Birth</label><input v-model="form.date_of_birth" type="date" class="form-control"></div>
        <div class="col-md-6"><label class="form-label">Phone</label><input v-model="form.phone" class="form-control" placeholder="+91 9876543210"></div>
        <div class="col-12 mt-2">
          <button class="btn-auth btn" @click="doRegister" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            {{ loading ? 'Registering…' : 'Create Patient Account' }}
          </button>
        </div>
      </div>
      <p class="text-center mt-3 mb-0" style="font-size:.875rem;color:#718096">
        Already registered? <router-link to="/login" style="color:#0d9488;font-weight:600">Sign In</router-link>
        &nbsp;|&nbsp; <router-link to="/register-doctor" style="color:#0d9488;font-weight:600">Register as Doctor</router-link>
      </p>
    </div>
  </div>`,
  setup() {
    const router  = VueRouter.useRouter();
    const form    = Vue.ref({ name:'', username:'', email:'', password:'', date_of_birth:'', phone:'' });
    const loading = Vue.ref(false);
    const doRegister = async () => {
      if (!form.value.name || !form.value.username || !form.value.email || !form.value.password)
        return window.$toast('Please fill all required fields', 'error');
      loading.value = true;
      try {
        await API.post('/register', form.value);
        window.$toast('Account created! Please sign in.', 'success');
        router.push('/login');
      } catch(e) { window.$toast(e.response?.data?.message || 'Registration failed', 'error'); }
      finally { loading.value = false; }
    };
    return { form, loading, doRegister };
  }
};

// ══════════════════════════════════════════════════════════════════
//  DOCTOR REGISTER
// ══════════════════════════════════════════════════════════════════
const RegisterDoctorPage = {
  template: `
  <div class="auth-page">
    <div class="auth-bg-pattern"></div><div class="auth-grid-overlay"></div>
    <div class="auth-card" style="max-width:520px">
      <div class="auth-logo">
        <div class="auth-logo-icon">👨‍⚕️</div>
        <h2>Doctor Registration</h2>
        <p>Create your doctor account — a unique Roll No will be assigned</p>
      </div>
      <div class="row g-3">
        <div class="col-12"><label class="form-label">Full Name *</label><input v-model="form.name" class="form-control" placeholder="Dr. Jane Smith" required></div>
        <div class="col-md-6"><label class="form-label">Username *</label><input v-model="form.username" class="form-control" placeholder="dr_jane" required></div>
        <div class="col-md-6"><label class="form-label">Email *</label><input v-model="form.email" type="email" class="form-control" placeholder="jane@hospital.com" required></div>
        <div class="col-md-6"><label class="form-label">Password *</label><input v-model="form.password" type="password" class="form-control" placeholder="••••••••" required></div>
        <div class="col-md-6"><label class="form-label">Specialization *</label><input v-model="form.specialization" class="form-control" placeholder="Cardiology" required></div>
        <div class="col-md-6"><label class="form-label">Experience (years)</label><input v-model.number="form.experience_years" type="number" min="0" class="form-control"></div>
        <div class="col-md-6"><label class="form-label">Department</label>
          <select v-model="form.department_id" class="form-select">
            <option value="">Select department…</option>
            <option v-for="d in depts" :key="d.id" :value="d.id">{{d.name}}</option>
          </select>
        </div>
        <div class="col-12"><label class="form-label">Profile Description</label>
          <textarea v-model="form.profile_description" class="form-control" rows="2" placeholder="Brief bio and areas of expertise…"></textarea>
        </div>
        <div class="col-12 mt-2">
          <button class="btn-auth btn" @click="doRegister" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            {{ loading ? 'Registering…' : 'Create Doctor Account' }}
          </button>
        </div>
      </div>
      <div v-if="rollNo" class="mt-3 p-3 rounded-3 text-center" style="background:#f0fdfa;border:1.5px solid #0d9488">
        <div style="font-size:.8rem;color:#0f766e;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Your Roll Number</div>
        <div style="font-size:1.6rem;font-weight:800;color:#0d9488;font-family:'Fraunces',serif">{{rollNo}}</div>
        <div style="font-size:.78rem;color:#64748b">Please save this — redirecting to login…</div>
      </div>
      <p class="text-center mt-3 mb-0" style="font-size:.875rem;color:#718096">
        Already registered? <router-link to="/login" style="color:#0d9488;font-weight:600">Sign In</router-link>
      </p>
    </div>
  </div>`,
  setup() {
    const router  = VueRouter.useRouter();
    const depts   = Vue.ref([]);
    const rollNo  = Vue.ref('');
    const loading = Vue.ref(false);
    const form    = Vue.ref({ name:'', username:'', email:'', password:'', specialization:'', experience_years:0, department_id:'', profile_description:'' });
    Vue.onMounted(async () => {
      try { const r = await API.get('/departments'); depts.value = r.data; } catch {}
    });
    const doRegister = async () => {
      if (!form.value.name || !form.value.username || !form.value.email || !form.value.password || !form.value.specialization)
        return window.$toast('Please fill all required fields', 'error');
      loading.value = true;
      try {
        const { data } = await API.post('/register-doctor', form.value);
        rollNo.value = data.roll_no;
        window.$toast(`Registered! Your Roll No: ${data.roll_no}`, 'success');
        setTimeout(() => router.push('/login'), 3000);
      } catch(e) { window.$toast(e.response?.data?.message || 'Registration failed', 'error'); }
      finally { loading.value = false; }
    };
    return { form, depts, rollNo, loading, doRegister };
  }
};

// ══════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════
const AdminDashboard = {
  template: `
  <div>
    <div class="page-header">
      <h3><i class="bi bi-speedometer2 me-2" style="color:#0d9488"></i>Admin Dashboard</h3>
      <p>Hospital overview at a glance</p>
    </div>
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon blue"><i class="bi bi-person-badge"></i></div><div><div class="stat-value">{{stats.total_doctors}}</div><div class="stat-label">Doctors</div></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon green"><i class="bi bi-people"></i></div><div><div class="stat-value">{{stats.total_patients}}</div><div class="stat-label">Patients</div></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon orange"><i class="bi bi-calendar-check"></i></div><div><div class="stat-value">{{stats.total_appointments}}</div><div class="stat-label">Total Appts</div></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon teal"><i class="bi bi-check-circle"></i></div><div><div class="stat-value">{{stats.completed_count}}</div><div class="stat-label">Completed</div></div></div></div>
    </div>
    <div class="content-card">
      <div class="card-title"><i class="bi bi-calendar-week" style="color:#0d9488"></i> Recent Appointments
        <span class="ms-auto" style="font-size:.78rem;font-weight:400;color:#94a3b8">Showing latest 15</span>
      </div>
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>#</th><th>Patient</th><th>Doctor</th><th>Roll No</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-if="!appts.length"><td colspan="7"><div class="empty-state"><span class="empty-icon">📅</span><p>No appointments yet</p></div></td></tr>
            <tr v-for="a in appts.slice(0,15)" :key="a.id">
              <td><span style="font-weight:700;color:#94a3b8">#{{a.id}}</span></td>
              <td><strong>{{a.patient_name}}</strong></td>
              <td>Dr. {{a.doctor_name}}</td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{a.doctor_roll_no}}</span></td>
              <td>{{fmtDate(a.appointment_date)}}</td>
              <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
              <td><span class="status-badge" :class="a.status">{{a.status}}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const stats = Vue.ref({ total_doctors:0, total_patients:0, total_appointments:0, completed_count:0 });
    const appts = Vue.ref([]);
    Vue.onMounted(async () => {
      try {
        const [s, a] = await Promise.all([API.get('/admin/dashboard'), API.get('/admin/appointments')]);
        stats.value = s.data; appts.value = a.data;
      } catch { window.$toast('Failed to load dashboard', 'error'); }
    });
    return { stats, appts, fmtDate };
  }
};

// ══════════════════════════════════════════════════════════════════
//  ADMIN DOCTORS
// ══════════════════════════════════════════════════════════════════
const AdminDoctors = {
  template: `
  <div>
    <div class="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div><h3><i class="bi bi-person-badge me-2" style="color:#0d9488"></i>Doctors</h3><p>Manage hospital doctors</p></div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-success" @click="exportCSV" :disabled="exporting">
          <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-download me-1"></i>{{exporting?'Exporting…':'Export CSV'}}
        </button>
        <button class="btn btn-primary" @click="openAdd"><i class="bi bi-plus-lg me-1"></i>Add Doctor</button>
      </div>
    </div>
    <div class="content-card mb-3">
      <div class="search-box"><i class="bi bi-search search-icon"></i>
        <input v-model="q" type="text" class="form-control" placeholder="Search by name, specialization or roll no…" @input="search">
      </div>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>Doctor</th><th>Roll No</th><th>Specialization</th><th>Department</th><th>Exp</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!list.length"><td colspan="7"><div class="empty-state"><span class="empty-icon">👨‍⚕️</span><p>No doctors found</p></div></td></tr>
            <tr v-for="d in list" :key="d.id">
              <td>
                <div class="d-flex align-items-center gap-2">
                  <div class="doctor-avatar" style="width:36px;height:36px;font-size:.9rem;margin-bottom:0">{{d.name[0]}}</div>
                  <div><div style="font-weight:600">Dr. {{d.name}}</div><div style="font-size:.78rem;color:#94a3b8">{{d.email}}</div></div>
                </div>
              </td>
              <td><span style="font-family:monospace;font-size:.82rem;background:#f1f5f9;padding:.15rem .5rem;border-radius:4px;font-weight:600">{{d.roll_no}}</span></td>
              <td>{{d.specialization}}</td>
              <td>{{d.department_name||'—'}}</td>
              <td><span style="font-weight:600">{{d.experience_years}}</span> <span style="color:#94a3b8;font-size:.8rem">yrs</span></td>
              <td><span class="status-badge" :class="d.status">{{d.status}}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-primary me-1" @click="openEdit(d)" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm me-1" :class="d.status==='blacklisted'?'btn-outline-success':'btn-outline-warning'" @click="toggleBlacklist(d)" :title="d.status==='blacklisted'?'Reinstate':'Blacklist'">
                  <i :class="d.status==='blacklisted'?'bi bi-check-circle':'bi bi-slash-circle'"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="del(d.id)" title="Delete"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Doctor Modal -->
    <div class="modal fade" id="docModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">{{editing?'Edit Doctor':'Add New Doctor'}}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Full Name</label><input v-model="form.name" class="form-control" placeholder="Dr. Jane Smith"></div>
          <div class="col-md-6"><label class="form-label">Username</label><input v-model="form.username" class="form-control" :disabled="editing" placeholder="dr_jane"></div>
          <div class="col-md-6"><label class="form-label">Email</label><input v-model="form.email" type="email" class="form-control"></div>
          <div class="col-md-6" v-if="!editing"><label class="form-label">Password</label><input v-model="form.password" type="password" class="form-control"></div>
          <div class="col-md-6"><label class="form-label">Specialization</label><input v-model="form.specialization" class="form-control"></div>
          <div class="col-md-6"><label class="form-label">Experience (years)</label><input v-model.number="form.experience_years" type="number" min="0" class="form-control"></div>
          <div class="col-12"><label class="form-label">Department</label>
            <select v-model="form.department_id" class="form-select"><option value="">Select…</option><option v-for="d in depts" :key="d.id" :value="d.id">{{d.name}}</option></select></div>
          <div class="col-12"><label class="form-label">Profile Description</label><textarea v-model="form.profile_description" class="form-control" rows="2"></textarea></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>{{editing?'Update':'Add Doctor'}}
        </button>
      </div>
    </div></div></div>
  </div>`,
  setup() {
    const list=Vue.ref([]); const depts=Vue.ref([]); const q=Vue.ref('');
    const editing=Vue.ref(null); const saving=Vue.ref(false);
    const form=Vue.ref({name:'',username:'',email:'',password:'',specialization:'',experience_years:0,department_id:'',profile_description:''});
    let modal;
    Vue.onMounted(async()=>{ modal=new bootstrap.Modal(document.getElementById('docModal')); await load(); });
    const load=async()=>{ const [r,d]=await Promise.all([API.get('/admin/data'),API.get('/patient/departments')]); list.value=r.data.doctors; depts.value=d.data; };
    const search=async()=>{ if(!q.value){const r=await API.get('/admin/data');list.value=r.data.doctors;return;} const r=await API.get(`/admin/search?type=doctor&query=${q.value}`);list.value=r.data; };
    const openAdd=()=>{ editing.value=null; form.value={name:'',username:'',email:'',password:'',specialization:'',experience_years:0,department_id:'',profile_description:''}; modal.show(); };
    const openEdit=d=>{ editing.value=d.id; form.value={...d}; modal.show(); };
    const save=async()=>{
      saving.value=true;
      try{
        if(editing.value) await API.put(`/admin/doctors/${editing.value}`,form.value);
        else await API.post('/admin/doctors',form.value);
        window.$toast('Doctor saved!','success'); modal.hide(); await load();
      }catch(e){window.$toast(e.response?.data?.message||'Error','error');}
      finally{saving.value=false;}
    };
    const del=async id=>{ if(!confirm('Delete this doctor?'))return; await API.delete(`/admin/doctors/${id}`); window.$toast('Doctor deleted','success'); await load(); };
    const toggleBlacklist=async d=>{
      const s=d.status==='blacklisted'?'active':'blacklisted';
      await API.put(`/admin/doctors/${d.id}`,{status:s});
      window.$toast(`Doctor ${s==='blacklisted'?'blacklisted — they can no longer login':'reinstated'}`,s==='blacklisted'?'error':'success');
      await load();
    };
    const exporting=Vue.ref(false);
    const exportCSV=async()=>{
      exporting.value=true;
      try{
        const r=await API.post('/admin/export/doctors',{},{responseType:'blob'});
        if(r.headers['content-type']?.includes('text/csv')){
          const url=URL.createObjectURL(r.data); const a=document.createElement('a'); a.href=url; a.download='all_doctors_history.csv'; a.click(); URL.revokeObjectURL(url);
          window.$toast('CSV downloaded!','success');
        }
      }catch{ window.$toast('Export failed','error'); }
      finally{exporting.value=false;}
    };
    return{list,depts,q,editing,saving,form,openAdd,openEdit,save,del,search,toggleBlacklist,exporting,exportCSV};
  }
};

// ══════════════════════════════════════════════════════════════════
//  ADMIN PATIENTS
// ══════════════════════════════════════════════════════════════════
const AdminPatients = {
  template: `
  <div>
    <div class="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div><h3><i class="bi bi-people me-2" style="color:#0d9488"></i>Patients</h3><p>Manage registered patients</p></div>
      <button class="btn btn-outline-success" @click="exportCSV" :disabled="exporting">
        <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="bi bi-download me-1"></i>{{exporting?'Exporting…':'Export All CSV'}}
      </button>
    </div>
    <div class="content-card mb-3"><div class="search-box"><i class="bi bi-search search-icon"></i>
      <input v-model="q" type="text" class="form-control" placeholder="Search patient by name…" @input="search"></div></div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>Patient</th><th>Email</th><th>Phone</th><th>DOB</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!list.length"><td colspan="6"><div class="empty-state"><span class="empty-icon">🧑‍⚕️</span><p>No patients found</p></div></td></tr>
            <tr v-for="p in list" :key="p.id">
              <td><div class="d-flex align-items-center gap-2">
                <div class="doctor-avatar" style="width:36px;height:36px;font-size:.9rem;margin-bottom:0;background:linear-gradient(135deg,#10b981,#059669)">{{p.name[0]}}</div>
                <strong>{{p.name}}</strong></div></td>
              <td style="color:#64748b">{{p.email}}</td>
              <td>{{p.phone||'—'}}</td>
              <td>{{fmtDate(p.date_of_birth)}}</td>
              <td><span class="status-badge" :class="p.status">{{p.status}}</span></td>
              <td>
                <button class="btn btn-sm me-1" :class="p.status==='blacklisted'?'btn-outline-success':'btn-outline-danger'" @click="toggle(p)">
                  {{p.status==='blacklisted'?'Reinstate':'Blacklist'}}
                </button>
                <router-link :to="'/admin/patient-history/'+p.id" class="btn btn-sm btn-outline-primary"><i class="bi bi-file-medical me-1"></i>History</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const list=Vue.ref([]); const q=Vue.ref('');
    const load=async()=>{ const r=await API.get('/admin/data'); list.value=r.data.patients; };
    const search=async()=>{ if(!q.value){load();return;} const r=await API.get(`/admin/search?type=patient&query=${q.value}`); list.value=r.data; };
    const toggle=async p=>{
      const s=p.status==='blacklisted'?'active':'blacklisted';
      await API.put(`/admin/patients/${p.id}/status`,{status:s});
      window.$toast(`Patient ${s==='blacklisted'?'blacklisted — they can no longer login':'reinstated'}`,s==='blacklisted'?'error':'success');
      load();
    };
    const exporting=Vue.ref(false);
    const exportCSV=async()=>{
      exporting.value=true;
      try{
        const r=await API.post('/admin/export/patients',{},{responseType:'blob'});
        if(r.headers['content-type']?.includes('text/csv')){
          const url=URL.createObjectURL(r.data); const a=document.createElement('a'); a.href=url; a.download='all_patients_history.csv'; a.click(); URL.revokeObjectURL(url);
          window.$toast('CSV downloaded!','success');
        }
      }catch{ window.$toast('Export failed','error'); }
      finally{exporting.value=false;}
    };
    Vue.onMounted(load);
    return{list,q,search,toggle,fmtDate,exporting,exportCSV};
  }
};

// ══════════════════════════════════════════════════════════════════
//  ADMIN APPOINTMENTS
// ══════════════════════════════════════════════════════════════════
const AdminAppointments = {
  template: `
  <div>
    <div class="page-header"><h3><i class="bi bi-calendar-check me-2" style="color:#0d9488"></i>All Appointments</h3></div>
    <div class="row g-2 mb-3">
      <div class="col-auto" v-for="s in ['all','booked','completed','cancelled']" :key="s">
        <button class="btn btn-sm" :class="filter===s?'btn-primary':'btn-outline-secondary'" @click="filter=s">
          {{s.charAt(0).toUpperCase()+s.slice(1)}} <span class="badge ms-1" :class="filter===s?'bg-white text-dark':'bg-secondary'">{{countFor(s)}}</span>
        </button>
      </div>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>#</th><th>Patient</th><th>Doctor</th><th>Roll No</th><th>Date</th><th>Slot</th><th>Status</th><th>Booked At</th></tr></thead>
          <tbody>
            <tr v-if="!filtered.length"><td colspan="8"><div class="empty-state"><p>No appointments found</p></div></td></tr>
            <tr v-for="a in filtered" :key="a.id">
              <td><span style="font-weight:700;color:#94a3b8">#{{a.id}}</span></td>
              <td><strong>{{a.patient_name}}</strong></td>
              <td>Dr. {{a.doctor_name}}</td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{a.doctor_roll_no}}</span></td>
              <td>{{fmtDate(a.appointment_date)}}</td>
              <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
              <td><span class="status-badge" :class="a.status">{{a.status}}</span></td>
              <td style="color:#94a3b8;font-size:.8rem">{{a.created_at?.split('T')[0]}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const appts=Vue.ref([]); const filter=Vue.ref('all');
    const filtered=Vue.computed(()=>filter.value==='all'?appts.value:appts.value.filter(a=>a.status===filter.value));
    const countFor=s=>s==='all'?appts.value.length:appts.value.filter(a=>a.status===s).length;
    Vue.onMounted(async()=>{ const r=await API.get('/admin/appointments'); appts.value=r.data; });
    return{appts,filter,filtered,countFor,fmtDate};
  }
};

const AdminPatientHistory = {
  template: `
  <div>
    <div class="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div>
        <router-link to="/admin/patients" class="btn btn-sm btn-outline-secondary mb-3"><i class="bi bi-arrow-left me-1"></i>Back</router-link>
        <h3><i class="bi bi-file-medical me-2" style="color:#0d9488"></i>History — {{data.patient?.name}}</h3>
      </div>
      <button class="btn btn-outline-success" @click="exportCSV" :disabled="exporting">
        <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="bi bi-download me-1"></i>{{exporting?'Exporting…':'Export CSV'}}
      </button>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>#</th><th>Date</th><th>Doctor</th><th>Roll No</th><th>Status</th><th>Diagnosis</th><th>Prescription</th><th>Next Visit</th></tr></thead>
          <tbody>
            <tr v-if="!data.history?.length"><td colspan="8"><div class="empty-state"><span class="empty-icon">📋</span><p>No history</p></div></td></tr>
            <tr v-for="h in data.history" :key="h.visit_number">
              <td><span class="history-num">{{h.visit_number}}</span></td>
              <td>{{fmtDate(h.appointment_date)}}</td>
              <td>Dr. {{h.doctor_name}}</td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{h.doctor_roll_no}}</span></td>
              <td><span class="status-badge" :class="h.status">{{h.status}}</span></td>
              <td>{{h.diagnosis||'—'}}</td><td>{{h.prescription||'—'}}</td><td>{{fmtDate(h.next_visit_date)}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const route=VueRouter.useRoute(); const data=Vue.ref({});
    const exporting=Vue.ref(false);
    Vue.onMounted(async()=>{ const r=await API.get(`/admin/patient-history/${route.params.id}`); data.value=r.data; });
    const exportCSV=async()=>{
      exporting.value=true;
      try{
        const r=await API.post(`/admin/export/patient/${route.params.id}`,{},{responseType:'blob'});
        if(r.headers['content-type']?.includes('text/csv')){
          const url=URL.createObjectURL(r.data); const a=document.createElement('a'); a.href=url; a.download=`patient_${route.params.id}_history.csv`; a.click(); URL.revokeObjectURL(url);
          window.$toast('CSV downloaded!','success');
        }
      }catch{ window.$toast('Export failed','error'); }
      finally{exporting.value=false;}
    };
    return{data,fmtDate,exporting,exportCSV};
  }
};

// ══════════════════════════════════════════════════════════════════
//  DOCTOR DASHBOARD
// ══════════════════════════════════════════════════════════════════
const DoctorDashboard = {
  template: `
  <div>
    <div class="page-header">
      <h3><i class="bi bi-speedometer2 me-2" style="color:#0d9488"></i>Doctor Dashboard</h3>
      <p v-if="dash.doctor">
        Dr. {{dash.doctor.name}} &nbsp;·&nbsp; <span style="color:#0d9488">{{dash.doctor.specialization}}</span>
        &nbsp;·&nbsp;
        <span style="font-family:monospace;background:#f1f5f9;padding:.15rem .5rem;border-radius:4px;font-weight:600;font-size:.9rem">{{dash.doctor.roll_no}}</span>
      </p>
    </div>
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon blue"><i class="bi bi-calendar-week"></i></div><div><div class="stat-value">{{dash.upcoming_appointments?.length||0}}</div><div class="stat-label">This Week</div></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card"><div class="stat-icon green"><i class="bi bi-people"></i></div><div><div class="stat-value">{{dash.assigned_patients?.length||0}}</div><div class="stat-label">Patients</div></div></div></div>
    </div>
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="content-card">
          <div class="card-title"><i class="bi bi-calendar-check" style="color:#0d9488"></i> Upcoming Appointments (Next 7 Days)</div>
          <div class="empty-state" v-if="!dash.upcoming_appointments?.length"><span class="empty-icon">📅</span><p>No upcoming appointments</p></div>
          <div class="table-responsive" v-else>
            <table class="hms-table">
              <thead><tr><th>Patient</th><th>Date</th><th>Slot</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="a in dash.upcoming_appointments" :key="a.id">
                  <td><strong>{{a.patient_name}}</strong></td>
                  <td>{{fmtDate(a.appointment_date)}}</td>
                  <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
                  <td>
                    <button class="btn btn-sm btn-success me-1" @click="openTreatment(a)"><i class="bi bi-check-lg me-1"></i>Complete</button>
                    <button class="btn btn-sm btn-outline-danger" @click="cancel(a.id)">Cancel</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="content-card">
          <div class="card-title"><i class="bi bi-people" style="color:#0d9488"></i> My Patients</div>
          <div class="empty-state" v-if="!dash.assigned_patients?.length"><span class="empty-icon">🧑‍⚕️</span><p>No patients yet</p></div>
          <ul class="list-unstyled mb-0" v-else>
            <li v-for="p in dash.assigned_patients" :key="p.id" class="d-flex align-items-center gap-2 py-2 border-bottom" style="border-color:#f1f5f9!important">
              <div class="doctor-avatar" style="width:38px;height:38px;font-size:.95rem;margin-bottom:0;background:linear-gradient(135deg,#10b981,#059669)">{{p.name[0]}}</div>
              <div><div style="font-weight:600;font-size:.9rem">{{p.name}}</div><div style="font-size:.75rem;color:#94a3b8">{{p.phone||p.email}}</div></div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <!-- Treatment Modal -->
    <div class="modal fade" id="treatModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">Complete Appointment & Add Treatment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <div class="mb-3"><label class="form-label">Diagnosis</label><textarea v-model="tf.diagnosis" class="form-control" rows="2" placeholder="Patient diagnosis…"></textarea></div>
        <div class="mb-3"><label class="form-label">Prescription</label><textarea v-model="tf.prescription" class="form-control" rows="2" placeholder="Medicines and dosage…"></textarea></div>
        <div class="mb-3"><label class="form-label">Doctor Notes</label><textarea v-model="tf.doctor_notes" class="form-control" rows="2" placeholder="Additional observations…"></textarea></div>
        <div class="mb-3"><label class="form-label">Next Visit Date <span style="color:#94a3b8;font-weight:400">(optional)</span></label><input v-model="tf.next_visit_date" type="date" class="form-control"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" @click="saveTreatment" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>Save & Mark Complete
        </button>
      </div>
    </div></div></div>
  </div>`,
  setup() {
    const dash=Vue.ref({}); const saving=Vue.ref(false);
    const tf=Vue.ref({appointment_id:null,diagnosis:'',prescription:'',doctor_notes:'',next_visit_date:''});
    let modal;
    const load=async()=>{ const r=await API.get('/doctor/dashboard'); dash.value=r.data; };
    Vue.onMounted(async()=>{ modal=new bootstrap.Modal(document.getElementById('treatModal')); await load(); });
    const openTreatment=a=>{ tf.value={appointment_id:a.id,diagnosis:'',prescription:'',doctor_notes:'',next_visit_date:''}; modal.show(); };
    const saveTreatment=async()=>{
      saving.value=true;
      try{ await API.post('/doctor/update-treatment',tf.value); window.$toast('Treatment saved & appointment completed!','success'); modal.hide(); load(); }
      catch(e){ window.$toast(e.response?.data?.message||'Error','error'); }
      finally{saving.value=false;}
    };
    const cancel=async id=>{ if(!confirm('Cancel this appointment?'))return; await API.delete(`/doctor/cancel-appointment/${id}`); window.$toast('Cancelled','success'); load(); };
    return{dash,saving,tf,openTreatment,saveTreatment,cancel,fmtDate};
  }
};

const DoctorAppointments = {
  template: `
  <div>
    <div class="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div><h3><i class="bi bi-calendar-check me-2" style="color:#0d9488"></i>Appointments</h3></div>
      <button class="btn btn-outline-success" @click="exportCSV" :disabled="exporting">
        <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="bi bi-download me-1"></i>{{exporting?'Exporting…':'Export CSV'}}
      </button>
    </div>
    <div class="content-card mb-3">
      <div class="row g-2 align-items-center">
        <div class="col-auto"><label class="form-label mb-0 me-2">Filter by date:</label></div>
        <div class="col-auto"><input v-model="dateFilter" type="date" class="form-control" style="max-width:200px" @change="load"></div>
        <div class="col-auto" v-if="dateFilter"><button class="btn btn-sm btn-outline-secondary" @click="dateFilter='';load()">Clear</button></div>
      </div>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>Patient</th><th>Date</th><th>Slot</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!appts.length"><td colspan="5"><div class="empty-state"><span class="empty-icon">📅</span><p>No appointments</p></div></td></tr>
            <tr v-for="a in appts" :key="a.id">
              <td><strong>{{a.patient_name}}</strong></td>
              <td>{{fmtDate(a.appointment_date)}}</td>
              <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
              <td><span class="status-badge" :class="a.status">{{a.status}}</span></td>
              <td>
                <button class="btn btn-sm btn-success me-1" v-if="a.status==='booked'" @click="openTreat(a)"><i class="bi bi-check-lg me-1"></i>Complete</button>
                <button class="btn btn-sm btn-outline-danger" v-if="a.status==='booked'" @click="cancel(a.id)">Cancel</button>
                <span style="color:#94a3b8;font-size:.8rem" v-if="a.status!=='booked'">{{a.status}}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal fade" id="docApptTreatModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">Add Treatment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <div class="mb-3"><label class="form-label">Diagnosis</label><textarea v-model="tf.diagnosis" class="form-control" rows="2"></textarea></div>
        <div class="mb-3"><label class="form-label">Prescription</label><textarea v-model="tf.prescription" class="form-control" rows="2"></textarea></div>
        <div class="mb-3"><label class="form-label">Doctor Notes</label><textarea v-model="tf.doctor_notes" class="form-control" rows="2"></textarea></div>
        <div class="mb-3"><label class="form-label">Next Visit Date</label><input v-model="tf.next_visit_date" type="date" class="form-control"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" @click="saveTreat">Save & Complete</button></div>
    </div></div></div>
  </div>`,
  setup() {
    const appts=Vue.ref([]); const dateFilter=Vue.ref('');
    const tf=Vue.ref({appointment_id:null,diagnosis:'',prescription:'',doctor_notes:'',next_visit_date:''});
    let modal;
    const load=async()=>{ const url=dateFilter.value?`/doctor/appointments?date=${dateFilter.value}`:'/doctor/appointments'; const r=await API.get(url); appts.value=r.data; };
    Vue.onMounted(async()=>{ modal=new bootstrap.Modal(document.getElementById('docApptTreatModal')); await load(); });
    const cancel=async id=>{ if(!confirm('Cancel?'))return; await API.delete(`/doctor/cancel-appointment/${id}`); window.$toast('Cancelled','success'); load(); };
    const openTreat=a=>{ tf.value={appointment_id:a.id,diagnosis:'',prescription:'',doctor_notes:'',next_visit_date:''}; modal.show(); };
    const saveTreat=async()=>{ try{ await API.post('/doctor/update-treatment',tf.value); window.$toast('Saved!','success'); modal.hide(); load(); }catch(e){window.$toast(e.response?.data?.message||'Error','error');} };
    const exporting=Vue.ref(false);
    const exportCSV=async()=>{
      exporting.value=true;
      try{
        const r=await API.post('/doctor/export-history',{},{responseType:'blob'});
        if(r.headers['content-type']?.includes('text/csv')){
          const url=URL.createObjectURL(r.data); const a=document.createElement('a'); a.href=url; a.download='my_appointments.csv'; a.click(); URL.revokeObjectURL(url);
          window.$toast('CSV downloaded!','success');
        }else{ window.$toast('Export started','info'); }
      }catch{ window.$toast('Export failed','error'); }
      finally{exporting.value=false;}
    };
    return{appts,dateFilter,load,cancel,tf,openTreat,saveTreat,fmtDate,exporting,exportCSV};
  }
};

const DoctorAvailabilityPage = {
  template: `
  <div>
    <div class="page-header"><h3><i class="bi bi-clock me-2" style="color:#0d9488"></i>Set Availability</h3><p>Toggle your availability for the next 7 days</p></div>
    <div class="content-card">
      <div class="card-title"><i class="bi bi-calendar3" style="color:#0d9488"></i> Weekly Schedule</div>
      <div v-if="days.length">
        <div v-for="d in days" :key="d.date" class="avail-toggle-row">
          <div class="avail-date-label"><strong>{{fmtDay(d.date)}}</strong><span style="color:#94a3b8;font-size:.78rem;margin-left:.5rem">{{d.date}}</span></div>
          <div class="slot-toggles">
            <label class="slot-toggle"><input type="checkbox" v-model="d.morning_slot_available"><span>☀️ Morning (08:00–12:00)</span></label>
            <label class="slot-toggle"><input type="checkbox" v-model="d.evening_slot_available"><span>🌙 Evening (16:00–21:00)</span></label>
          </div>
        </div>
      </div>
      <div class="mt-4 pt-3 border-top">
        <button class="btn btn-primary px-5" @click="save" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>{{saving?'Saving…':'Save Availability'}}
        </button>
      </div>
    </div>
  </div>`,
  setup() {
    const days=Vue.ref([]); const saving=Vue.ref(false);
    Vue.onMounted(async()=>{
      let existing={};
      try{ const r=await API.get('/doctor/availability'); r.data.forEach(a=>{existing[a.date]=a;}); }catch{}
      days.value=next7().map(date=>({date,morning_slot_available:existing[date]?.morning_slot_available??true,evening_slot_available:existing[date]?.evening_slot_available??true}));
    });
    const save=async()=>{
      saving.value=true;
      try{ await API.post('/doctor/availability',{availabilities:days.value}); window.$toast('Availability saved!','success'); }
      catch{ window.$toast('Error saving','error'); }finally{saving.value=false;}
    };
    return{days,saving,save,fmtDay};
  }
};

// ══════════════════════════════════════════════════════════════════
//  PATIENT DASHBOARD  — book appointments, see available slots live
// ══════════════════════════════════════════════════════════════════
const PatientDashboard = {
  template: `
  <div>
    <div class="page-header">
      <h3><i class="bi bi-house me-2" style="color:#0d9488"></i>Find a Doctor</h3>
      <p>Browse departments and book your appointment</p>
    </div>

    <!-- Upcoming appointments summary -->
    <div class="content-card mb-4" v-if="upcoming.length">
      <div class="card-title"><i class="bi bi-calendar-check" style="color:#0d9488"></i> Your Upcoming Appointments</div>
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>Doctor</th><th>Roll No</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="a in upcoming" :key="a.id">
              <td>Dr. {{a.doctor_name}}</td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{a.doctor_roll_no}}</span></td>
              <td>{{fmtDate(a.appointment_date)}}</td>
              <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
              <td><span class="status-badge" :class="a.status">{{a.status}}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Departments -->
    <div class="content-card mb-4">
      <div class="card-title"><i class="bi bi-grid" style="color:#0d9488"></i> Departments</div>
      <div class="row g-3">
        <div class="col-6 col-md-3 col-lg-2" v-for="d in depts" :key="d.id">
          <div class="dept-card" :class="{selected:selectedDept===d.id}" @click="selectDept(d.id)">
            <span class="dept-icon">{{deptIcon(d.name)}}</span>
            <div class="dept-name">{{d.name}}</div>
            <div class="dept-desc">{{d.description}}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Doctors -->
    <div class="content-card" v-if="selectedDept">
      <div class="card-title"><i class="bi bi-person-badge" style="color:#0d9488"></i> Available Doctors</div>
      <div class="row g-3">
        <div class="col-12" v-if="!doctors.length"><div class="empty-state"><span class="empty-icon">👨‍⚕️</span><p>No doctors in this department</p></div></div>
        <div class="col-md-4 col-lg-3" v-for="d in doctors" :key="d.id">
          <div class="doctor-card" @click="d.status==='active'&&openBook(d)">
            <div class="doctor-avatar">{{d.name[0]}}</div>
            <div class="doctor-name">Dr. {{d.name}}</div>
            <div class="doctor-spec">{{d.specialization}}</div>
            <div class="doctor-meta"><i class="bi bi-hash"></i><span style="font-family:monospace;font-size:.78rem">{{d.roll_no}}</span></div>
            <div class="doctor-meta"><i class="bi bi-briefcase"></i>{{d.experience_years}} yrs exp.</div>
            <div v-if="d.status==='active'" class="mt-auto pt-2 w-100"><button class="btn btn-outline-primary btn-sm w-100 mt-1">Book Appointment</button></div>
            <div v-else class="mt-2"><span class="status-badge blacklisted">Unavailable</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Book Modal -->
    <div class="modal fade" id="bookModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">Book Appointment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body" v-if="selDoc">
        <div class="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
          <div class="doctor-avatar" style="margin-bottom:0">{{selDoc.name[0]}}</div>
          <div>
            <div class="doctor-name">Dr. {{selDoc.name}}</div>
            <div class="doctor-spec">{{selDoc.specialization}}</div>
            <div class="doctor-meta"><i class="bi bi-hash"></i><span style="font-family:monospace">{{selDoc.roll_no}}</span> · {{selDoc.experience_years}} yrs</div>
          </div>
        </div>
        <label class="form-label fw-bold mb-3">Select date &amp; time slot:</label>
        <div class="avail-grid">
          <div v-for="av in avail7" :key="av.date" class="avail-day-card">
            <div class="day-label">{{fmtDay(av.date)}}</div>
            <!-- Morning slot -->
            <button class="slot-btn" :class="slotClass(av,'Morning')" :disabled="!av.morning_slot_available" @click="selectSlot(av.date,'Morning')">
              ☀️ Morning
              <span v-if="av.morning_booked" style="display:block;font-size:.62rem;opacity:.7">Booked</span>
              <span v-else-if="av.morning_set_unavailable" style="display:block;font-size:.62rem;opacity:.7">Unavailable</span>
            </button>
            <!-- Evening slot -->
            <button class="slot-btn" :class="slotClass(av,'Evening')" :disabled="!av.evening_slot_available" @click="selectSlot(av.date,'Evening')">
              🌙 Evening
              <span v-if="av.evening_booked" style="display:block;font-size:.62rem;opacity:.7">Booked</span>
              <span v-else-if="av.evening_set_unavailable" style="display:block;font-size:.62rem;opacity:.7">Unavailable</span>
            </button>
          </div>
        </div>
        <div class="mt-3" v-if="selectedSlot.date">
          <div class="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3" style="background:#f0fdfa;border:1.5px solid #0d9488">
            <i class="bi bi-check-circle-fill" style="color:#0d9488"></i>
            <span style="font-size:.875rem;font-weight:600;color:#0f766e">{{fmtDay(selectedSlot.date)}} — {{selectedSlot.time}} slot selected</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" @click="confirmBook" :disabled="!selectedSlot.date||booking">
          <span v-if="booking" class="spinner-border spinner-border-sm me-1"></span>Confirm Booking
        </button>
      </div>
    </div></div></div>
  </div>`,
  setup() {
    const depts=Vue.ref([]); const doctors=Vue.ref([]); const selectedDept=Vue.ref(null);
    const selDoc=Vue.ref(null); const avail7=Vue.ref([]); const selectedSlot=Vue.ref({});
    const booking=Vue.ref(false); const upcoming=Vue.ref([]);
    let modal;
    Vue.onMounted(async()=>{
      modal=new bootstrap.Modal(document.getElementById('bookModal'));
      const [dr, du]=await Promise.all([API.get('/patient/departments'), API.get('/patient/dashboard')]);
      depts.value=dr.data;
      upcoming.value=du.data.upcoming_appointments||[];
    });
    const selectDept=async id=>{ selectedDept.value=id; const r=await API.get(`/patient/doctors?department_id=${id}`); doctors.value=r.data; };
    const openBook=async d=>{
      selDoc.value=d; selectedSlot.value={};
      const r=await API.get(`/patient/doctor-availability/${d.id}`);
      avail7.value=r.data;
      modal.show();
    };
    const selectSlot=(date,time)=>{ selectedSlot.value={date,time}; };
    const slotClass=(av,slot)=>{
      const avail = slot==='Morning'?av.morning_slot_available:av.evening_slot_available;
      if(!avail) return 'unavailable';
      if(selectedSlot.value.date===av.date && selectedSlot.value.time===slot) return 'selected-slot';
      return 'available';
    };
    const confirmBook=async()=>{
      booking.value=true;
      try{
        await API.post('/patient/book-appointment',{doctor_id:selDoc.value.id,appointment_date:selectedSlot.value.date,appointment_time:selectedSlot.value.time});
        window.$toast('Appointment booked! 🎉','success');
        modal.hide();
        // Refresh upcoming
        const du=await API.get('/patient/dashboard'); upcoming.value=du.data.upcoming_appointments||[];
      }catch(e){ window.$toast(e.response?.data?.message||'Booking failed','error'); }
      finally{booking.value=false;}
    };
    return{depts,doctors,selectedDept,selDoc,avail7,selectedSlot,booking,upcoming,selectDept,openBook,selectSlot,slotClass,confirmBook,fmtDate,fmtDay,deptIcon};
  }
};

// ══════════════════════════════════════════════════════════════════
//  PATIENT APPOINTMENTS
// ══════════════════════════════════════════════════════════════════
const PatientAppointments = {
  template: `
  <div>
    <div class="page-header"><h3><i class="bi bi-calendar-check me-2" style="color:#0d9488"></i>My Appointments</h3></div>
    <div class="row g-2 mb-3">
      <div class="col-auto" v-for="s in ['all','booked','completed','cancelled']" :key="s">
        <button class="btn btn-sm" :class="filter===s?'btn-primary':'btn-outline-secondary'" @click="filter=s">
          {{s.charAt(0).toUpperCase()+s.slice(1)}} <span class="badge ms-1" :class="filter===s?'bg-white text-dark':'bg-secondary'">{{countFor(s)}}</span>
        </button>
      </div>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>#</th><th>Doctor</th><th>Roll No</th><th>Date</th><th>Slot</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="!filtered.length"><td colspan="7"><div class="empty-state"><span class="empty-icon">📅</span><p>No appointments</p></div></td></tr>
            <tr v-for="(a,i) in filtered" :key="a.appointment_id">
              <td><span class="history-num">{{i+1}}</span></td>
              <td><strong>Dr. {{a.doctor_name}}</strong></td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{a.doctor_roll_no}}</span></td>
              <td>{{fmtDate(a.appointment_date)}}</td>
              <td><span v-if="a.appointment_time==='Morning'" class="slot-morning">☀️ Morning</span><span v-else class="slot-evening">🌙 Evening</span></td>
              <td><span class="status-badge" :class="a.status">{{a.status}}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-danger me-1" v-if="a.status==='booked'" @click="cancel(a.appointment_id)">Cancel</button>
                <button class="btn btn-sm btn-outline-secondary" v-if="a.status==='booked'" @click="openReschedule(a)">Reschedule</button>
                <span style="color:#94a3b8;font-size:.8rem" v-if="a.status!=='booked'">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal fade" id="reschedModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">Reschedule Appointment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <div class="mb-3"><label class="form-label">New Date</label><input v-model="rf.appointment_date" type="date" class="form-control" :min="today()"></div>
        <div class="mb-3"><label class="form-label">Time Slot</label>
          <select v-model="rf.appointment_time" class="form-select">
            <option value="Morning">☀️ Morning (08:00–12:00)</option>
            <option value="Evening">🌙 Evening (16:00–21:00)</option>
          </select></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" @click="doReschedule">Confirm</button></div>
    </div></div></div>
  </div>`,
  setup() {
    const appts=Vue.ref([]); const filter=Vue.ref('all');
    const filtered=Vue.computed(()=>filter.value==='all'?appts.value:appts.value.filter(a=>a.status===filter.value));
    const countFor=s=>s==='all'?appts.value.length:appts.value.filter(a=>a.status===s).length;
    const rf=Vue.ref({id:null,appointment_date:'',appointment_time:'Morning'});
    let modal;
    const load=async()=>{ const r=await API.get('/patient/history'); appts.value=r.data; };
    Vue.onMounted(async()=>{ modal=new bootstrap.Modal(document.getElementById('reschedModal')); await load(); });
    const cancel=async id=>{ if(!confirm('Cancel this appointment?'))return; await API.delete(`/patient/cancel-appointment/${id}`); window.$toast('Cancelled','success'); load(); };
    const openReschedule=a=>{ rf.value={id:a.appointment_id,appointment_date:'',appointment_time:a.appointment_time}; modal.show(); };
    const doReschedule=async()=>{
      try{ await API.put(`/patient/reschedule-appointment/${rf.value.id}`,rf.value); window.$toast('Rescheduled!','success'); modal.hide(); load(); }
      catch(e){ window.$toast(e.response?.data?.message||'Error','error'); }
    };
    return{appts,filter,filtered,countFor,rf,cancel,openReschedule,doReschedule,today,fmtDate};
  }
};

// ══════════════════════════════════════════════════════════════════
//  PATIENT HISTORY
// ══════════════════════════════════════════════════════════════════
const PatientHistory = {
  template: `
  <div>
    <div class="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div><h3><i class="bi bi-file-medical me-2" style="color:#0d9488"></i>Treatment History</h3><p>Complete medical records</p></div>
      <button class="btn btn-outline-success" @click="exportCSV" :disabled="exporting">
        <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="bi bi-download me-1"></i>{{exporting?'Exporting…':'Export CSV'}}
      </button>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="hms-table">
          <thead><tr><th>Visit</th><th>Date</th><th>Doctor</th><th>Roll No</th><th>Status</th><th>Diagnosis</th><th>Prescription</th><th>Notes</th><th>Next Visit</th></tr></thead>
          <tbody>
            <tr v-if="!hist.length"><td colspan="9"><div class="empty-state"><span class="empty-icon">📋</span><p>No treatment history yet</p></div></td></tr>
            <tr v-for="h in hist" :key="h.appointment_id">
              <td><span class="history-num">{{h.visit_number}}</span></td>
              <td>{{fmtDate(h.appointment_date)}}</td>
              <td>Dr. {{h.doctor_name}}</td>
              <td><span style="font-family:monospace;font-size:.8rem;background:#f1f5f9;padding:.1rem .4rem;border-radius:4px">{{h.doctor_roll_no}}</span></td>
              <td><span class="status-badge" :class="h.status">{{h.status}}</span></td>
              <td>{{h.diagnosis||'—'}}</td><td>{{h.prescription||'—'}}</td><td>{{h.doctor_notes||'—'}}</td><td>{{fmtDate(h.next_visit_date)}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const hist=Vue.ref([]); const exporting=Vue.ref(false);
    Vue.onMounted(async()=>{ const r=await API.get('/patient/history'); hist.value=r.data; });
    const exportCSV=async()=>{
      exporting.value=true;
      try{
        const r=await API.post('/patient/export-history',{},{responseType:'blob'});
        if(r.headers['content-type']?.includes('text/csv')){
          const url=URL.createObjectURL(r.data); const a=document.createElement('a'); a.href=url; a.download='treatment_history.csv'; a.click(); URL.revokeObjectURL(url);
          window.$toast('CSV downloaded!','success');
        }else{ const json=JSON.parse(await r.data.text()); window.$toast(json.message||'Export started','info'); }
      }catch{ window.$toast('Export started (check back soon)','info'); }
      finally{exporting.value=false;}
    };
    return{hist,exporting,exportCSV,fmtDate};
  }
};

// Patient Profile
const PatientProfile = {
  template: `
  <div>
    <div class="page-header"><h3><i class="bi bi-person-circle me-2" style="color:#0d9488"></i>My Profile</h3></div>
    <div class="profile-header-card mb-4" v-if="profile.name">
      <div class="profile-avatar-lg">{{profile.name[0]}}</div>
      <div><h3 class="profile-name">{{profile.name}}</h3>
        <div class="profile-meta"><i class="bi bi-envelope me-1"></i>{{profile.email}}</div>
        <div class="profile-meta mt-1"><i class="bi bi-phone me-1"></i>{{profile.phone||'No phone'}}</div>
        <div class="mt-2"><span class="status-badge active">Active Patient</span></div></div>
    </div>
    <div class="content-card">
      <div class="card-title"><i class="bi bi-pencil-square" style="color:#0d9488"></i> Edit Profile</div>
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">Full Name</label><input v-model="form.name" class="form-control"></div>
        <div class="col-md-6"><label class="form-label">Phone</label><input v-model="form.phone" class="form-control"></div>
        <div class="col-12"><label class="form-label">Address</label><textarea v-model="form.address" class="form-control" rows="2"></textarea></div>
        <div class="col-md-6"><label class="form-label">Date of Birth</label><input v-model="form.date_of_birth" type="date" class="form-control"></div>
        <div class="col-12 mt-2"><button class="btn btn-primary px-4" @click="save" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>{{saving?'Saving…':'Save Changes'}}</button></div>
      </div>
    </div>
  </div>`,
  setup() {
    const profile=Vue.ref({}); const form=Vue.ref({name:'',phone:'',address:'',date_of_birth:''}); const saving=Vue.ref(false);
    Vue.onMounted(async()=>{ const r=await API.get('/patient/dashboard'); profile.value=r.data.user; form.value={name:r.data.user.name||'',phone:r.data.user.phone||'',address:r.data.user.address||'',date_of_birth:r.data.user.date_of_birth||''}; });
    const save=async()=>{
      saving.value=true;
      try{ await API.put('/patient/profile',form.value); window.$toast('Profile updated!','success'); const r=await API.get('/patient/dashboard'); profile.value=r.data.user; }
      catch(e){window.$toast(e.response?.data?.message||'Error','error');}
      finally{saving.value=false;}
    };
    return{profile,form,saving,save};
  }
};



// ══════════════════════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════════════════════
const routes = [
  { path:'/',                          redirect:'/login' },
  { path:'/login',                     component:LoginPage },
  { path:'/register',                  component:RegisterPage },
  { path:'/register-doctor',           component:RegisterDoctorPage },
  // Admin
  { path:'/admin/dashboard',           component:AdminDashboard,      meta:{role:'admin'} },
  { path:'/admin/doctors',             component:AdminDoctors,         meta:{role:'admin'} },
  { path:'/admin/patients',            component:AdminPatients,        meta:{role:'admin'} },
  { path:'/admin/appointments',        component:AdminAppointments,    meta:{role:'admin'} },
  { path:'/admin/patient-history/:id', component:AdminPatientHistory,  meta:{role:'admin'} },
  // Doctor
  { path:'/doctor/dashboard',          component:DoctorDashboard,      meta:{role:'doctor'} },
  { path:'/doctor/appointments',       component:DoctorAppointments,   meta:{role:'doctor'} },
  { path:'/doctor/availability',       component:DoctorAvailabilityPage, meta:{role:'doctor'} },
  // Patient
  { path:'/patient/dashboard',         component:PatientDashboard,     meta:{role:'patient'} },
  { path:'/patient/appointments',      component:PatientAppointments,  meta:{role:'patient'} },
  { path:'/patient/history',           component:PatientHistory,       meta:{role:'patient'} },
  { path:'/patient/profile',           component:PatientProfile,       meta:{role:'patient'} },
  { path:'/:pathMatch(.*)*',           redirect:'/login' },
];

const router = VueRouter.createRouter({ history:VueRouter.createWebHistory(), routes });
router.beforeEach(to => {
  const token=localStorage.getItem('token'), role=localStorage.getItem('role');
  if (!to.meta.role) return true;
  if (!token) return '/login';
  if (to.meta.role !== role) {
    if (role==='admin')  return '/admin/dashboard';
    if (role==='doctor') return '/doctor/dashboard';
    return '/patient/dashboard';
  }
  return true;
});

// ══════════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════════
const App = {
  template: `
  <div>
    <nav class="hms-navbar navbar navbar-expand-lg" v-if="isAuthenticated">
      <div class="container-fluid px-4">
        <span class="navbar-brand"><span class="brand-pulse"></span>HMS Portal</span>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
          <span class="bi bi-list text-white fs-4"></span>
        </button>
        <div class="collapse navbar-collapse" id="navMain">
          <ul class="navbar-nav me-auto gap-1 mt-2 mt-lg-0">
            <template v-if="role==='admin'">
              <li class="nav-item"><router-link class="nav-link" to="/admin/dashboard"><i class="bi bi-speedometer2"></i>Dashboard</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/admin/doctors"><i class="bi bi-person-badge"></i>Doctors</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/admin/patients"><i class="bi bi-people"></i>Patients</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/admin/appointments"><i class="bi bi-calendar-check"></i>Appointments</router-link></li>
            </template>
            <template v-if="role==='doctor'">
              <li class="nav-item"><router-link class="nav-link" to="/doctor/dashboard"><i class="bi bi-speedometer2"></i>Dashboard</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/doctor/appointments"><i class="bi bi-calendar-check"></i>Appointments</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/doctor/availability"><i class="bi bi-clock"></i>Availability</router-link></li>
            </template>
            <template v-if="role==='patient'">
              <li class="nav-item"><router-link class="nav-link" to="/patient/dashboard"><i class="bi bi-house"></i>Home</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/patient/appointments"><i class="bi bi-calendar-check"></i>Appointments</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/patient/history"><i class="bi bi-file-medical"></i>History</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/patient/profile"><i class="bi bi-person-circle"></i>Profile</router-link></li>
            </template>
          </ul>
          <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">
            <div class="user-badge">
              <i class="bi bi-person-circle"></i>{{ username }}
              <span v-if="rollNo" style="font-family:monospace;font-size:.7rem;opacity:.8">({{rollNo}})</span>
              <span class="role-chip">{{ role }}</span>
            </div>
            <button class="btn btn-sm btn-outline-light px-3" @click="logout"><i class="bi bi-box-arrow-right me-1"></i>Logout</button>
          </div>
        </div>
      </div>
    </nav>
    <div :class="isAuthenticated?'page-wrapper':''"><router-view></router-view></div>
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" class="hms-toast" :class="t.type">
        <span class="toast-icon">{{t.type==='success'?'✅':t.type==='error'?'❌':'ℹ️'}}</span>
        <span class="toast-msg">{{t.msg}}</span>
      </div>
    </div>
  </div>`,
  setup() {
    const role     = Vue.ref(localStorage.getItem('role'));
    const username = Vue.ref(localStorage.getItem('username'));
    const rollNo   = Vue.ref(localStorage.getItem('roll_no'));
    const isAuthenticated = Vue.computed(()=>!!localStorage.getItem('token'));
    const logout = ()=>{ localStorage.clear(); router.push('/login'); };
    router.afterEach(()=>{
      role.value     = localStorage.getItem('role');
      username.value = localStorage.getItem('username');
      rollNo.value   = localStorage.getItem('roll_no');
    });
    return { role, username, rollNo, isAuthenticated, logout, toasts: toastBus.toasts };
  }
};

Vue.createApp(App).use(router).mount('#app');
