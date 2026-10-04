import React, { useState, useEffect } from 'react';
import katex from 'katex';
import {
  Divide,
  Superscript,
  Subscript,
  Radical,
  Sigma,
  Variable,
  Plus,
  Check,
  Sparkles,
  BookOpen,
  Calculator,
  RotateCcw
} from 'lucide-react';
import { Modal } from './ui/Modal.tsx';
import { Button } from './ui/Button.tsx';
import { Badge } from './ui/Badge.tsx';

interface EquationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (equationText: string, formulaName: string) => void;
}

// Preset Rumus Tambang Standar
export const MINING_FORMULA_PRESETS = [
  {
    id: 'sr',
    name: 'Stripping Ratio (SR)',
    category: 'Produksi',
    equation: '\\text{SR} = \\frac{\\text{Volume Overburden (bcm)}}{\\text{Tonase Ore (ton)}}',
    display: 'SR = Volume Overburden / Tonase Ore',
    description: 'Perbandingan jumlah tanah penutup (bcm) yang harus dikupas terhadap bijih atau batubara (ton) yang diperoleh.',
    variables: [
      { sym: 'SR', desc: 'Stripping ratio (bcm/ton)' },
      { sym: 'Overburden', desc: 'Volume lapisan tanah penutup (bcm)' },
      { sym: 'Ore', desc: 'Massa endapan bahan galian berharga (ton)' }
    ]
  },
  {
    id: 'besr',
    name: 'Break-Even Stripping Ratio (BESR)',
    category: 'Ekonomi Tambang',
    equation: '\\text{BESR} = \\frac{\\text{Harga Jual (P)} - \\text{Biaya Penambangan (C_m)}}{\\text{Biaya Pengupasan Waste (C_w)}}',
    display: 'BESR = (P - Cm) / Cw',
    description: 'Batas ekonomis maksimal nisbah kupas di mana keuntungan operasional sama dengan nol (titik impas).',
    variables: [
      { sym: 'P', desc: 'Harga jual komoditas tambang per ton' },
      { sym: 'C_m', desc: 'Biaya penambangan dan pengolahan per ton' },
      { sym: 'C_w', desc: 'Biaya pengupasan lapisan penutup per bcm' }
    ]
  },
  {
    id: 'bishop',
    name: 'Faktor Keamanan Lereng (Metode Bishop)',
    category: 'Geoteknik',
    equation: '\\text{FK} = \\frac{\\sum \\left[ \\frac{c\' \\cdot b + (W - u \\cdot b) \\tan \\phi\'}{\\cos \\alpha \\left(1 + \\frac{\\tan \\alpha \\tan \\phi\'}{\\text{FK}}\\right)} \\right]}{\\sum W \\sin \\alpha}',
    display: 'FK = Total Gaya Penahan / Total Gaya Penggerak',
    description: 'Evaluasi kestabilan lereng tambang terbuka terhadap keruntuhan busur lingkaran (FK aman > 1.25 - 1.50).',
    variables: [
      { sym: 'c\'', desc: 'Kohesi efektif batuan / tanah (kPa)' },
      { sym: '\\phi\'', desc: 'Sudut geser dalam efektif batuan (derajat)' },
      { sym: 'W', desc: 'Berat irisan massa batuan lereng (kN)' },
      { sym: 'u', desc: 'Tekanan air pori (pore water pressure)' },
      { sym: '\\alpha', desc: 'Sudut kemiringan bidang gelincir tiap irisan' }
    ]
  },
  {
    id: 'npv',
    name: 'Net Present Value (NPV)',
    category: 'Finansial & Kelayakan',
    equation: '\\text{NPV} = \\sum_{t=1}^N \\frac{\\text{Arus Kas}_t}{(1 + r)^t} - \\text{Investasi Awal } (I_0)',
    display: 'NPV = Total Arus Kas Terdiskon - Modal Awal',
    description: 'Total estimasi keuntungan bersih proyek tambang masa depan yang dinilai dengan nilai uang saat ini.',
    variables: [
      { sym: 't', desc: 'Periode tahun umur tambang (1, 2, ... N)' },
      { sym: 'r', desc: 'Tingkat diskonto suku bunga (discount rate, %)' },
      { sym: 'I_0', desc: 'Biaya kapital investasi awal (CAPEX)' }
    ]
  },
  {
    id: 'match_factor',
    name: 'Match Factor (Kesesuaian Alat Mekanis)',
    category: 'Produksi',
    equation: '\\text{MF} = \\frac{N_t \\times n \\times t_l}{N_l \\times t_t}',
    display: 'MF = (Jumlah Truk × Rit Bucket × Waktu Isi) / (Jumlah Loader × Waktu Edar Truk)',
    description: 'Tingkat keserasian sinkronisasi antara armada truk pengangkut dan alat gali-muat (Loader/Excavator). MF = 1.0 adalah kondisi optimal.',
    variables: [
      { sym: 'N_t', desc: 'Jumlah armada truk pengangkut aktif' },
      { sym: 'N_l', desc: 'Jumlah alat gali-muat (excavator/shovel)' },
      { sym: 't_l', desc: 'Waktu pemuatan per rit bucket (menit)' },
      { sym: 't_t', desc: 'Waktu edar total truk angkut (cycle time)' }
    ]
  },
  {
    id: 'limpasan',
    name: 'Debit Limpasan Rasional (Drainase Tambang)',
    category: 'Hidrologi',
    equation: 'Q = 0.278 \\times C \\times I \\times A',
    display: 'Q = 0.278 × C × I × A',
    description: 'Perhitungan debit puncak air limpasan hujan untuk penentuan dimensi saluran terbuka (drainage) dan kapasitas kolam pengendap.',
    variables: [
      { sym: 'Q', desc: 'Debit puncak limpasan permukaan (m³/detik)' },
      { sym: 'C', desc: 'Koefisien limpasan daerah tangkapan hujan' },
      { sym: 'I', desc: 'Intensitas curah hujan rencana (mm/jam)' },
      { sym: 'A', desc: 'Luas catchment area tangkapan air (km²)' }
    ]
  },
  {
    id: 'kriging',
    name: 'Ordinary Kriging Estimator',
    category: 'Geostatistik',
    equation: 'Z^*(x_0) = \\sum_{i=1}^n \\lambda_i Z(x_i) \\quad \\text{dengan syarat} \\quad \\sum_{i=1}^n \\lambda_i = 1',
    display: 'Z*(x0) = Jumlah(Bobot × Kadar Sampel Bor)',
    description: 'Estimasi kadar blok tanpa bias (unbiased) dengan variansi estimasi minimum berdasarkan model semivariogram spasial.',
    variables: [
      { sym: 'Z^*(x_0)', desc: 'Kadar estimasi pada titik/blok target' },
      { sym: 'Z(x_i)', desc: 'Kadar sampel lubang bor ke-i' },
      { sym: '\\lambda_i', desc: 'Bobot pembobotan Kriging untuk sampel ke-i' }
    ]
  },
  {
    id: 'rmr',
    name: 'Rock Mass Rating (Bieniawski RMR)',
    category: 'Geomekanika',
    equation: '\\text{RMR} = R_1 + R_2 + R_3 + R_4 + R_5 + R_{\\text{penyesuaian diskontinuitas}}',
    display: 'RMR = UCS + RQD + Spasi + Kondisi + Air Tanah + Orientasi Kekar',
    description: 'Klasifikasi kualitas massa batuan untuk perancangan penyanggaan tambang bawah tanah dan kestabilan lereng.',
    variables: [
      { sym: 'R_1', desc: 'Kekuatan batuan utuh (UCS test)' },
      { sym: 'R_2', desc: 'Rock Quality Designation (RQD %)' },
      { sym: 'R_3', desc: 'Spasi bidang diskontinuitas' },
      { sym: 'R_4', desc: 'Kondisi kekar dan isian rekahan' },
      { sym: 'R_5', desc: 'Kondisi air tanah pada massa batuan' }
    ]
  },
  {
    id: 'cog',
    name: 'Cut-Off Grade (COG)',
    category: 'Perencanaan Tambang',
    equation: '\\text{COG} = \\frac{C_{\\text{tambang}} + C_{\\text{pengolahan}}}{(P - C_{\\text{penjualan}}) \\times R_{\\text{recovery}}}',
    display: 'COG = (Biaya Tambang + Biaya Pabrik) / ((Harga - Biaya Jual) × Recovery)',
    description: 'Kadar batas terendah suatu endapan mineral yang masih bernilai ekonomis untuk ditambang dan diproses.',
    variables: [
      { sym: 'C', desc: 'Komponen biaya operasional total ($/ton)' },
      { sym: 'P', desc: 'Harga komoditas di pasar internasional' },
      { sym: 'R', desc: 'Tingkat perolehan metalurgi pabrik pengolahan' }
    ]
  },
  {
    id: 'cadangan_tonase',
    name: 'Tonase Cadangan Blok (Reserve Volume)',
    category: 'Pemodelan Geologi',
    equation: 'T = L_x \\times L_y \\times L_z \\times \\rho \\times (1 - \\text{Dilusi})',
    display: 'Tonase = Panjang × Lebar × Tinggi × Densitas Batuan × (1 - Dilusi)',
    description: 'Perhitungan tonase massa bijih terukur dalam satu sel block model tambang.',
    variables: [
      { sym: 'L_x, L_y, L_z', desc: 'Dimensi blok grid (meter)' },
      { sym: '\\rho', desc: 'Spesific Gravity / Densitas batuan (ton/m³)' },
      { sym: 'Dilusi', desc: 'Faktor pengotoran batuan samping (%)' }
    ]
  }
];

export const EquationBuilderModal: React.FC<EquationBuilderModalProps> = ({
  isOpen,
  onClose,
  onInsert
}) => {
  const [activeTab, setActiveTab] = useState<'visual_builder' | 'mining_presets'>('visual_builder');

  // Visual Builder Elements
  const [eqType, setEqType] = useState<'fraction' | 'script' | 'radical' | 'sum' | 'linear'>('fraction');
  const [numerator, setNumerator] = useState('Volume Overburden');
  const [denominator, setDenominator] = useState('Tonase Ore');
  const [leftHand, setLeftHand] = useState('SR');
  const [baseVar, setBaseVar] = useState('x');
  const [exponent, setExponent] = useState('2');
  const [subscript, setSubscript] = useState('i');
  const [radicalVal, setRadicalVal] = useState('2gH');
  const [radicalDegree, setRadicalDegree] = useState('');
  const [sumFrom, setSumFrom] = useState('i=1');
  const [sumTo, setSumTo] = useState('n');
  const [sumExpr, setSumExpr] = useState('x_i');
  const [linearExpr, setLinearExpr] = useState('0.278 \\times C \\times I \\times A');
  const [formulaTitle, setFormulaTitle] = useState('Formula Tambang');

  // Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>(MINING_FORMULA_PRESETS[0].id);

  // Live Rendered KaTeX HTML
  const [renderedHtml, setRenderedHtml] = useState<string>('');

  const generateCurrentLatex = (): string => {
    if (activeTab === 'mining_presets') {
      const preset = MINING_FORMULA_PRESETS.find(p => p.id === selectedPresetId);
      return preset ? preset.equation : '';
    }

    // Visual Builder
    switch (eqType) {
      case 'fraction':
        return `${leftHand ? `${leftHand} = ` : ''}\\frac{${numerator || '1'}}{${denominator || '1'}}`;
      case 'script':
        if (exponent && subscript) {
          return `${leftHand ? `${leftHand} = ` : ''}${baseVar}_{${subscript}}^{${exponent}}`;
        } else if (exponent) {
          return `${leftHand ? `${leftHand} = ` : ''}${baseVar}^{${exponent}}`;
        } else {
          return `${leftHand ? `${leftHand} = ` : ''}${baseVar}_{${subscript || 'i'}}`;
        }
      case 'radical':
        if (radicalDegree) {
          return `${leftHand ? `${leftHand} = ` : ''}\\sqrt[${radicalDegree}]{${radicalVal || 'x'}}`;
        }
        return `${leftHand ? `${leftHand} = ` : ''}\\sqrt{${radicalVal || 'x'}}`;
      case 'sum':
        return `${leftHand ? `${leftHand} = ` : ''}\\sum_{${sumFrom}}^{${sumTo}} ${sumExpr}`;
      case 'linear':
      default:
        return `${leftHand ? `${leftHand} = ` : ''}${linearExpr}`;
    }
  };

  useEffect(() => {
    try {
      const latex = generateCurrentLatex();
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false
      });
      setRenderedHtml(html);
    } catch {
      setRenderedHtml('<span class="text-xs text-neutral-400">Pratinjau rumus tidak tersedia</span>');
    }
  }, [
    activeTab,
    eqType,
    leftHand,
    numerator,
    denominator,
    baseVar,
    exponent,
    subscript,
    radicalVal,
    radicalDegree,
    sumFrom,
    sumTo,
    sumExpr,
    linearExpr,
    selectedPresetId
  ]);

  const handleApplyInsert = () => {
    const latex = generateCurrentLatex();
    let name = formulaTitle;
    if (activeTab === 'mining_presets') {
      const preset = MINING_FORMULA_PRESETS.find(p => p.id === selectedPresetId);
      if (preset) name = preset.name;
    }
    onInsert(latex, name);
    onClose();
  };

  // Insert symbol helper into active field
  const insertSymbol = (sym: string) => {
    if (eqType === 'fraction') {
      setNumerator(prev => prev + sym);
    } else if (eqType === 'linear') {
      setLinearExpr(prev => prev + sym);
    } else if (eqType === 'radical') {
      setRadicalVal(prev => prev + sym);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Penyusun Rumus & Formulasi Matematika"
      description="Buat dan susun rumus teknis tambang dengan tampilan visual seperti Microsoft Word."
      size="lg"
    >
      <div className="space-y-4 pt-2">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('visual_builder')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'visual_builder'
                ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-500" />
            Penyusun Visual (Model MS Word)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mining_presets')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'mining_presets'
                ? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            Koleksi Rumus Tambang Standar
          </button>
        </div>

        {/* TAB 1: VISUAL BUILDER */}
        {activeTab === 'visual_builder' && (
          <div className="space-y-4">
            {/* Visual Template Selector (Word Style) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                1. Pilih Struktur Rumus (Template):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* Fraction */}
                <button
                  type="button"
                  onClick={() => setEqType('fraction')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    eqType === 'fraction'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <Divide className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Pecahan / Rasio</span>
                </button>

                {/* Script / Pangkat */}
                <button
                  type="button"
                  onClick={() => setEqType('script')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    eqType === 'script'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <Superscript className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Pangkat &amp; Indeks</span>
                </button>

                {/* Akar */}
                <button
                  type="button"
                  onClick={() => setEqType('radical')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    eqType === 'radical'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <Radical className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Bentuk Akar</span>
                </button>

                {/* Sigma / Summation */}
                <button
                  type="button"
                  onClick={() => setEqType('sum')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    eqType === 'sum'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <Sigma className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Sigma &amp; Total</span>
                </button>

                {/* Linear */}
                <button
                  type="button"
                  onClick={() => setEqType('linear')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    eqType === 'linear'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <Variable className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Perkalian Sebaris</span>
                </button>
              </div>
            </div>

            {/* Visual Word-like Interactive Input Boxes */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.08] space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                2. Masukkan Variabel / Komponen Rumus:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Simbol Hasil (Kiri):
                  </label>
                  <input
                    type="text"
                    value={leftHand}
                    onChange={e => setLeftHand(e.target.value)}
                    placeholder="Misal: SR, BESR, Q, FK"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Nama / Judul Formulasi:
                  </label>
                  <input
                    type="text"
                    value={formulaTitle}
                    onChange={e => setFormulaTitle(e.target.value)}
                    placeholder="Misal: Perhitungan Nisbah Kupas"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Inputs Based on Eq Type */}
              {eqType === 'fraction' && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06] space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Pembilang (Numerator - Atas):
                    </label>
                    <input
                      type="text"
                      value={numerator}
                      onChange={e => setNumerator(e.target.value)}
                      placeholder="Misal: Volume Overburden (bcm)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Penyebut (Denominator - Bawah):
                    </label>
                    <input
                      type="text"
                      value={denominator}
                      onChange={e => setDenominator(e.target.value)}
                      placeholder="Misal: Tonase Ore (ton)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {eqType === 'script' && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Variabel Dasar:
                    </label>
                    <input
                      type="text"
                      value={baseVar}
                      onChange={e => setBaseVar(e.target.value)}
                      placeholder="Misal: (1 + r)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Pangkat Atas (Superscript):
                    </label>
                    <input
                      type="text"
                      value={exponent}
                      onChange={e => setExponent(e.target.value)}
                      placeholder="Misal: t atau 2"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Indeks Bawah (Subscript):
                    </label>
                    <input
                      type="text"
                      value={subscript}
                      onChange={e => setSubscript(e.target.value)}
                      placeholder="Misal: i atau o"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {eqType === 'radical' && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Derajat Akar (Opsional):
                    </label>
                    <input
                      type="text"
                      value={radicalDegree}
                      onChange={e => setRadicalDegree(e.target.value)}
                      placeholder="Kosongkan untuk akar 2"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Nilai di Dalam Akar:
                    </label>
                    <input
                      type="text"
                      value={radicalVal}
                      onChange={e => setRadicalVal(e.target.value)}
                      placeholder="Misal: 2gH atau \\sigma^2"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {eqType === 'sum' && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Batas Bawah:
                    </label>
                    <input
                      type="text"
                      value={sumFrom}
                      onChange={e => setSumFrom(e.target.value)}
                      placeholder="Misal: i=1"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Batas Atas:
                    </label>
                    <input
                      type="text"
                      value={sumTo}
                      onChange={e => setSumTo(e.target.value)}
                      placeholder="Misal: n atau N"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Ekspresi yang Dijumlahkan:
                    </label>
                    <input
                      type="text"
                      value={sumExpr}
                      onChange={e => setSumExpr(e.target.value)}
                      placeholder="Misal: \\lambda_i Z(x_i)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {eqType === 'linear' && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06]">
                  <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                    Persamaan Linear / Operasi Matematika:
                  </label>
                  <input
                    type="text"
                    value={linearExpr}
                    onChange={e => setLinearExpr(e.target.value)}
                    placeholder="Misal: 0.278 \\times C \\times I \\times A"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Quick Math Symbols Inserter Toolbar */}
              <div className="pt-2 border-t border-neutral-200/60 dark:border-white/[0.06]">
                <span className="text-[10px] text-neutral-400 font-semibold block mb-1.5">
                  Klik untuk Sisipkan Simbol Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '×', val: ' \\times ' },
                    { label: '÷', val: ' \\div ' },
                    { label: '±', val: ' \\pm ' },
                    { label: '≈', val: ' \\approx ' },
                    { label: '≤', val: ' \\le ' },
                    { label: '≥', val: ' \\ge ' },
                    { label: '≠', val: ' \\ne ' },
                    { label: 'Δ', val: ' \\Delta ' },
                    { label: 'α', val: ' \\alpha ' },
                    { label: 'β', val: ' \\beta ' },
                    { label: 'γ', val: ' \\gamma ' },
                    { label: 'θ', val: ' \\theta ' },
                    { label: 'σ', val: ' \\sigma ' },
                    { label: 'τ', val: ' \\tau ' },
                    { label: 'ρ', val: ' \\rho ' },
                    { label: 'λ', val: ' \\lambda ' },
                    { label: 'π', val: ' \\pi ' },
                    { label: '∞', val: ' \\infty ' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertSymbol(s.val)}
                      className="px-2 py-1 text-xs font-mono font-bold rounded-md bg-white dark:bg-slate-800 border border-neutral-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-500 transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MINING PRESETS */}
        {activeTab === 'mining_presets' && (
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Pilih dari Koleksi Rumus Perencanaan Tambang:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
              {MINING_FORMULA_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                      : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {preset.name}
                    </span>
                    <Badge variant="outline" size="sm" className="text-[9px]">
                      {preset.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    {preset.display}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Explanation of Selected Preset Variables */}
            {(() => {
              const activePreset = MINING_FORMULA_PRESETS.find(p => p.id === selectedPresetId);
              if (!activePreset || !activePreset.variables) return null;
              return (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 text-xs">
                  <div className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Keterangan Variabel:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {activePreset.variables.map((v, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {v.sym}:
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Live Visual Render Box (Mathematical Quality) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#070A10] border-2 border-emerald-500/30 text-center shadow-inner">
          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
            Pratinjau Hasil Rumus (Tipografi Matematika Visual):
          </div>
          <div
            className="text-base sm:text-lg overflow-x-auto py-2 text-neutral-900 dark:text-white"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-white/[0.08]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApplyInsert}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Sisipkan Rumus ke Catatan
          </Button>
        </div>
      </div>
    </Modal>
  );
};
