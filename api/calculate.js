// Vercel Serverless Function - Maaş Hesaplama API
module.exports = (req, res) => {
  // CORS headers (farklı domain'lerden erişim için)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Sadece POST isteklerini kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Frontend'den gelen veriyi al
    const { 
      bekoGrossSalary, 
      lastGrossSalary, 
      primCarpani, 
      selectedYear, 
      besStatus, 
      ssTipi, 
      ssSayisi 
    } = req.body;

    // Input validasyonu
    if (!bekoGrossSalary || bekoGrossSalary <= 0) {
      return res.status(400).json({ 
        error: 'Geçerli bir brüt maaş giriniz' 
      });
    }

    // Hesaplama sabitleri (artık backend'de güvenli!)
    const CONSTANTS = {
      GROSS_SALARY_MULTIPLIER: 4/3,
      SGK_EMPLOYEE_RATE: 0.14,
      UNEMPLOYMENT_INSURANCE_RATE: 0.01,
      STAMP_TAX_RATE: 0.00759,
      SGK_CEILING_MULTIPLIER: 7.5,
      BES_RATE: 0.03,
      KOC_PENSION_RATE: 0.06,
      
      MIN_WAGE: {
        '2023H2': 13414.5,
        '2024': 20002.5,
        '2025': 26005.5
      },
      
      HEALTH_INSURANCE: {
        TSS: { '2024': 474, '2025': 844.5 },
        OSS: { '2024': 834.4375, '2025': 1335.1 }
      },
      
      INCOME_TAX_BRACKETS: {
        '2024': [
          { limit: 110000, rate: 0.15 },
          { limit: 230000, rate: 0.20 },
          { limit: 870000, rate: 0.27 },
          { limit: 3000000, rate: 0.35 },
          { limit: Infinity, rate: 0.40 }
        ],
        '2025': [
          { limit: 158000, rate: 0.15 },
          { limit: 330000, rate: 0.20 },
          { limit: 1200000, rate: 0.27 },
          { limit: 4300000, rate: 0.35 },
          { limit: Infinity, rate: 0.40 }
        ]
      }
    };

    // Temel hesaplamalar
    const grossSalary = bekoGrossSalary * CONSTANTS.GROSS_SALARY_MULTIPLIER;
    const currentMinWage = CONSTANTS.MIN_WAGE[selectedYear];
    const prevMinWage = selectedYear === "2024" ? CONSTANTS.MIN_WAGE['2023H2'] : CONSTANTS.MIN_WAGE['2024'];
    
    if (grossSalary < currentMinWage) {
      return res.status(400).json({ 
        error: `Brüt maaş asgari ücretten (${currentMinWage.toLocaleString('tr-TR')} TL) az olamaz` 
      });
    }

    // Sağlık sigortası hesaplama
    const healthInsurance = calculateHealthInsurance(ssTipi, parseInt(ssSayisi), selectedYear, CONSTANTS);
    
    // Ana hesaplama
    const result = performCalculations({
      bekoGrossSalary,
      grossSalary,
      lastGrossSalary: lastGrossSalary || 0,
      primCarpani: primCarpani || 0,
      selectedYear,
      besStatus,
      healthInsurance
    }, CONSTANTS);

    // Başarılı sonucu döndür
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ 
      error: 'Hesaplama sırasında bir hata oluştu' 
    });
  }
}

// Sağlık sigortası hesaplama fonksiyonu
function calculateHealthInsurance(ssTipi, ssSayisi, selectedYear, CONSTANTS) {
  const tssPrice = CONSTANTS.HEALTH_INSURANCE.TSS[selectedYear];
  const ossPrice = CONSTANTS.HEALTH_INSURANCE.OSS[selectedYear];
  
  if (ssTipi === "tss") {
    return (ssSayisi - 1) * tssPrice;
  } else {
    return ssSayisi > 2 
      ? (ssSayisi - 2) * ossPrice * 0.4 + 2 * ossPrice 
      : ssSayisi * ossPrice;
  }
}

// Ana hesaplama fonksiyonu
function performCalculations(inputs, CONSTANTS) {
  const { bekoGrossSalary, grossSalary, lastGrossSalary, primCarpani, selectedYear, besStatus, healthInsurance } = inputs;
  
  const currentMinWage = CONSTANTS.MIN_WAGE[selectedYear];
  const prevMinWage = selectedYear === "2024" ? CONSTANTS.MIN_WAGE['2023H2'] : CONSTANTS.MIN_WAGE['2024'];
  const sgkCeiling = currentMinWage * CONSTANTS.SGK_CEILING_MULTIPLIER;
  const prevSgkCeiling = prevMinWage * CONSTANTS.SGK_CEILING_MULTIPLIER;
  
  const besRate = besStatus === "var" ? CONSTANTS.BES_RATE : 0;
  const tssPrice = CONSTANTS.HEALTH_INSURANCE.TSS[selectedYear];
  
  // Sonuç dizisi
  const monthlyResults = [];
  
  // Hesaplama değişkenleri
  let totalMatrah = 0;
  let totalNet = 0;
  let totalVakif = 0;
  let totalBes = 0;
  let totalSS = 0;
  let totalNetOdeme = 0;
  let totalRdPayback = 0;
  let previousCumulativeIncomeTax = 0;
  let previousMinWageCumulativeIncomeTax = 0;
  
  let carryOverSgkMatrahLast = lastGrossSalary > prevSgkCeiling ? lastGrossSalary - prevSgkCeiling : 0;
  let carryOverSgkMatrahPrev = 0;
  let carryOverSgkMatrahNew = 0;
  
  // 12 aylık hesaplama
  for (let month = 1; month <= 12; month++) {
    // SGK matrah hesaplama
    let sgkTaxableWage;
    if (grossSalary >= sgkCeiling) {
      carryOverSgkMatrahNew = grossSalary - sgkCeiling;
      sgkTaxableWage = sgkCeiling;
    } else {
      carryOverSgkMatrahNew = 0;
      if (grossSalary + carryOverSgkMatrahLast >= sgkCeiling) {
        carryOverSgkMatrahLast = grossSalary + carryOverSgkMatrahLast - sgkCeiling;
        sgkTaxableWage = sgkCeiling;
      } else {
        if (grossSalary + carryOverSgkMatrahPrev + carryOverSgkMatrahLast > sgkCeiling) {
          sgkTaxableWage = sgkCeiling;
        } else {
          sgkTaxableWage = grossSalary + carryOverSgkMatrahPrev + carryOverSgkMatrahLast;
        }
        carryOverSgkMatrahLast = 0;
      }
    }
    
    carryOverSgkMatrahPrev = carryOverSgkMatrahLast;
    carryOverSgkMatrahLast = carryOverSgkMatrahNew;

    // Kesintiler
    const sgkDeduction = sgkTaxableWage * CONSTANTS.SGK_EMPLOYEE_RATE;
    const unemploymentDeduction = sgkTaxableWage * CONSTANTS.UNEMPLOYMENT_INSURANCE_RATE;
    const stampTax = (grossSalary + tssPrice - currentMinWage) * CONSTANTS.STAMP_TAX_RATE;
    const kocPensionDeduction = bekoGrossSalary * CONSTANTS.KOC_PENSION_RATE;
    const besDeduction = sgkTaxableWage * besRate;

    // Gelir vergisi matrahı
    const monthlyIncomeMatrah = grossSalary - (sgkDeduction + unemploymentDeduction) + CONSTANTS.STAMP_TAX_RATE * tssPrice - healthInsurance;
    totalMatrah += monthlyIncomeMatrah;

    // Gelir vergisi hesaplama
    const { cumulativeTax, monthlyTax } = calculateIncomeTax(totalMatrah, previousCumulativeIncomeTax, selectedYear, CONSTANTS);
    
    // Asgari ücret gelir vergisi
    const minWageTotalMatrah = month * currentMinWage * (1 - (CONSTANTS.SGK_EMPLOYEE_RATE + CONSTANTS.UNEMPLOYMENT_INSURANCE_RATE));
    const { cumulativeTax: minWageCumulativeTax } = calculateIncomeTax(minWageTotalMatrah, previousMinWageCumulativeIncomeTax, selectedYear, CONSTANTS);

    // Net maaş
    const netSalary = grossSalary - (sgkDeduction + unemploymentDeduction + monthlyTax - (minWageCumulativeTax - previousMinWageCumulativeIncomeTax) + stampTax) + CONSTANTS.STAMP_TAX_RATE * tssPrice;
    const netPayment = netSalary - (kocPensionDeduction + besDeduction + healthInsurance);

    // Toplamları güncelle
    totalNet += netSalary;
    totalVakif += kocPensionDeduction;
    totalBes += besDeduction;
    totalSS += healthInsurance;
    totalNetOdeme += netPayment;
    totalRdPayback += stampTax;
    
    previousCumulativeIncomeTax = cumulativeTax;
    previousMinWageCumulativeIncomeTax = minWageCumulativeTax;

    // Aylık sonucu kaydet
    monthlyResults.push({
      month: `${month}. Ay`,
      netSalary: parseFloat(netSalary.toFixed(2)),
      kocPension: parseFloat(kocPensionDeduction.toFixed(2)),
      bes: parseFloat(besDeduction.toFixed(2)),
      healthInsurance: parseFloat(healthInsurance.toFixed(2)),
      netPayment: parseFloat(netPayment.toFixed(2)),
      stampTax: parseFloat(stampTax.toFixed(2))
    });
  }

  // Performans primi hesaplama (eğer varsa)
  if (primCarpani > 0) {
    const bonusGrossSalary = bekoGrossSalary * primCarpani;
    let bonusSgkTaxableWage = 0;
    
    if (sgkTaxableWage === sgkCeiling) {
      bonusSgkTaxableWage = 0;
    } else {
      if (bonusGrossSalary + sgkTaxableWage >= sgkCeiling) {
        bonusSgkTaxableWage = sgkCeiling - sgkTaxableWage;
      } else {
        bonusSgkTaxableWage = bonusGrossSalary;
      }
    }

    const bonusDeductions = {
      sgk: bonusSgkTaxableWage * CONSTANTS.SGK_EMPLOYEE_RATE,
      unemployment: bonusSgkTaxableWage * CONSTANTS.UNEMPLOYMENT_INSURANCE_RATE,
      stamp: bonusGrossSalary * CONSTANTS.STAMP_TAX_RATE,
      bes: bonusSgkTaxableWage * besRate
    };

    const bonusIncomeMatrah = bonusGrossSalary - (bonusDeductions.sgk + bonusDeductions.unemployment);
    totalMatrah += bonusIncomeMatrah;

    const { monthlyTax: bonusTax } = calculateIncomeTax(totalMatrah, previousCumulativeIncomeTax, selectedYear, CONSTANTS);
    
    const bonusNetSalary = bonusGrossSalary - (bonusDeductions.sgk + bonusDeductions.unemployment + bonusTax + bonusDeductions.stamp);
    const bonusNetPayment = bonusNetSalary - bonusDeductions.bes;

    totalNet += bonusNetSalary;
    totalBes += bonusDeductions.bes;
    totalNetOdeme += bonusNetPayment;
    totalRdPayback += bonusDeductions.stamp;

    monthlyResults.push({
      month: 'Performans Primi',
      netSalary: parseFloat(bonusNetSalary.toFixed(2)),
      kocPension: 0,
      bes: parseFloat(bonusDeductions.bes.toFixed(2)),
      healthInsurance: 0,
      netPayment: parseFloat(bonusNetPayment.toFixed(2)),
      stampTax: parseFloat(bonusDeductions.stamp.toFixed(2))
    });
  }

  return {
    monthlyResults,
    totals: {
      totalNet: Math.round(totalNet),
      totalVakif: Math.round(totalVakif),
      totalBes: Math.round(totalBes),
      totalSS: Math.round(totalSS),
      totalNetOdeme: Math.round(totalNetOdeme),
      totalRdPayback: Math.round(totalRdPayback)
    }
  };
}

// Gelir vergisi hesaplama
function calculateIncomeTax(totalMatrah, previousCumulativeTax, selectedYear, CONSTANTS) {
  const brackets = CONSTANTS.INCOME_TAX_BRACKETS[selectedYear];
  let remainingIncome = totalMatrah;
  let cumulativeTax = 0;

  for (let i = 0; i < brackets.length; i++) {
    const { limit, rate } = brackets[i];
    const previousLimit = i > 0 ? brackets[i - 1].limit : 0;

    if (remainingIncome > 0) {
      const bracketIncome = Math.min(remainingIncome, limit - previousLimit);
      cumulativeTax += bracketIncome * rate;
      remainingIncome -= bracketIncome;
    } else {
      break;
    }
  }

  return {
    cumulativeTax,
    monthlyTax: cumulativeTax - previousCumulativeTax
  };
};