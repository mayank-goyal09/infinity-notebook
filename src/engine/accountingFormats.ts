import {
  AccountingFormatType,
  AccountingTableObject,
  TableColumn,
  TableRow,
  TableCell,
} from '../types/document';

export interface AccountingFormatMeta {
  type: AccountingFormatType;
  name: string;
  category: 'Bookkeeping' | 'Ledgers' | 'Financial Statements' | 'Reconciliation & Aging' | 'Operations & Payroll' | 'Custom';
  description: string;
  defaultTitle: string;
  recommendedWidth: number;
  hasAutoBalance?: boolean;
}

export const ACCOUNTING_FORMAT_CATALOG: AccountingFormatMeta[] = [
  {
    type: 'journal',
    name: 'General Journal',
    category: 'Bookkeeping',
    description: 'Standard 5-column double-entry journal with Date, Particulars/Narration, L.F., Debit & Credit amounts.',
    defaultTitle: 'General Journal Entries',
    recommendedWidth: 720,
    hasAutoBalance: true,
  },
  {
    type: 'ledger_t',
    name: 'General Ledger (T-Account)',
    category: 'Ledgers',
    description: 'Traditional bi-lateral ledger account with Debit side (Left) and Credit side (Right).',
    defaultTitle: 'Ledger Account (T-Shape)',
    recommendedWidth: 840,
    hasAutoBalance: true,
  },
  {
    type: 'ledger_running',
    name: 'Ledger (Running Balance)',
    category: 'Ledgers',
    description: 'Modern 7-column ledger with Date, Particulars, Ref, Debit, Credit, Running Balance, and Dr/Cr flag.',
    defaultTitle: 'Ledger (Self-Balancing / Running)',
    recommendedWidth: 780,
    hasAutoBalance: true,
  },
  {
    type: 'trial_balance',
    name: 'Trial Balance',
    category: 'Financial Statements',
    description: 'Summary of all ledger balances to verify equality of total debits and total credits.',
    defaultTitle: 'Trial Balance as of Period End',
    recommendedWidth: 700,
    hasAutoBalance: true,
  },
  {
    type: 'balance_sheet',
    name: 'Balance Sheet (Statement of Financial Position)',
    category: 'Financial Statements',
    description: 'Horizontal or classified format displaying Assets, Liabilities, and Owner Equity.',
    defaultTitle: 'Balance Sheet as of [Date]',
    recommendedWidth: 760,
    hasAutoBalance: true,
  },
  {
    type: 'income_statement',
    name: 'Profit & Loss / Income Statement',
    category: 'Financial Statements',
    description: 'Summary of revenues, cost of goods sold, operating expenses, and net profit for the period.',
    defaultTitle: 'Statement of Profit and Loss',
    recommendedWidth: 680,
  },
  {
    type: 'cash_flow',
    name: 'Cash Flow Statement',
    category: 'Financial Statements',
    description: 'Categorized breakdown of cash flows from Operating, Investing, and Financing activities.',
    defaultTitle: 'Statement of Cash Flows',
    recommendedWidth: 680,
  },
  {
    type: 'brs',
    name: 'Bank Reconciliation Statement (BRS)',
    category: 'Reconciliation & Aging',
    description: 'Reconciliation between bank balance as per Cash Book and balance as per Bank Statement.',
    defaultTitle: 'Bank Reconciliation Statement',
    recommendedWidth: 720,
  },
  {
    type: 'petty_cash',
    name: 'Petty Cash Book (Analytical Imprest)',
    category: 'Bookkeeping',
    description: 'Multi-column analytical cash book for routine petty expenses with expense classification columns.',
    defaultTitle: 'Petty Cash Book (Imprest System)',
    recommendedWidth: 920,
  },
  {
    type: 'stock_register',
    name: 'Inventory / Stores Ledger (Stock Register)',
    category: 'Operations & Payroll',
    description: 'Inventory movement register tracking Receipts, Issues, and Stock Balance (Qty, Rate, Amount).',
    defaultTitle: 'Stores Ledger Account (Inventory Register)',
    recommendedWidth: 920,
  },
  {
    type: 'payroll',
    name: 'Payroll / Salary Sheet',
    category: 'Operations & Payroll',
    description: 'Monthly payroll register with Basic, Allowances, Gross Salary, Deductions (PF/Tax), and Net Payable.',
    defaultTitle: 'Monthly Payroll Register',
    recommendedWidth: 920,
  },
  {
    type: 'ar_aging',
    name: 'Accounts Receivable (AR) Aging',
    category: 'Reconciliation & Aging',
    description: 'Aging schedule classifying outstanding customer receivables into 0-30, 31-60, 61-90, 90+ days.',
    defaultTitle: 'Accounts Receivable Aging Schedule',
    recommendedWidth: 860,
  },
  {
    type: 'ap_ledger',
    name: 'Accounts Payable (AP) Vendor Ledger',
    category: 'Reconciliation & Aging',
    description: 'Vendor payment tracking with Bill date, Due date, Total amount, Paid amount, and Balance due.',
    defaultTitle: 'Accounts Payable Ledger',
    recommendedWidth: 800,
  },
  {
    type: 'custom_table',
    name: 'Custom Spreadsheet Table',
    category: 'Custom',
    description: 'Blank, fully resizable spreadsheet grid for custom accounts, schedules, or notes.',
    defaultTitle: 'Custom Accounting Schedule',
    recommendedWidth: 640,
  },
];

function makeCell(value: string, opts?: Partial<TableCell>): TableCell {
  return {
    value,
    align: opts?.align || 'left',
    format: opts?.format || 'text',
    bold: opts?.bold,
    italic: opts?.italic,
    doubleUnderline: opts?.doubleUnderline,
    isTotal: opts?.isTotal,
    bgColor: opts?.bgColor,
    textColor: opts?.textColor,
  };
}

export const STANDARD_ACCOUNT_NAMES = [
  'Cash',
  'Bank Account',
  'Accounts Receivable',
  'Allowance for Doubtful Accounts',
  'Inventory / Merchandise',
  'Prepaid Insurance',
  'Prepaid Rent',
  'Office Supplies',
  'Office Equipment',
  'Accumulated Depreciation',
  'Accounts Payable',
  'Notes Payable',
  'Salaries Payable',
  'Interest Payable',
  'Capital Account',
  'Owner Drawings',
  'Sales Revenue',
  'Service Revenue',
  'Cost of Goods Sold',
  'Rent Expense',
  'Salaries & Wages Expense',
  'Utilities Expense',
  'Advertising Expense',
  'Insurance Expense',
  'Depreciation Expense',
  'Interest Expense',
];

export function extractExistingAccountNames(tables: AccountingTableObject[]): string[] {
  const list = [...STANDARD_ACCOUNT_NAMES];
  const seen = new Set<string>(list.map((s) => s.toLowerCase()));

  for (const table of tables) {
    for (const row of table.rows) {
      if (row.isTotal || row.isSubtotal) continue;
      for (const [colId, cell] of Object.entries(row.cells)) {
        if (!cell || !cell.value) continue;
        const trimmed = cell.value.trim();
        const lowerCol = colId.toLowerCase();
        if (
          trimmed.length > 1 &&
          !/^\d+$/.test(trimmed) &&
          (lowerCol.includes('particulars') ||
            lowerCol.includes('title') ||
            lowerCol.includes('desc') ||
            lowerCol.includes('part') ||
            lowerCol.includes('account'))
        ) {
          if (!seen.has(trimmed.toLowerCase())) {
            seen.add(trimmed.toLowerCase());
            list.unshift(trimmed);
          }
        }
      }
    }
  }

  return list;
}

export function applyDrCrMutualExclusivity(
  columns: TableColumn[],
  cells: Record<string, TableCell>,
  changedColId: string,
  newVal: string
): Record<string, TableCell> {
  const updatedCells = { ...cells };
  const lowerId = changedColId.toLowerCase();

  const isDebit = lowerId.includes('debit') || lowerId === 'dr_amt';
  const isCredit = lowerId.includes('credit') || lowerId === 'cr_amt';

  if ((isDebit || isCredit) && newVal.trim() !== '') {
    if (isDebit) {
      const crCol = columns.find((c) => c.id.toLowerCase().includes('credit') || c.id === 'cr_amt');
      if (crCol && updatedCells[crCol.id]) {
        updatedCells[crCol.id] = { ...updatedCells[crCol.id], value: '' };
      }
    } else if (isCredit) {
      const drCol = columns.find((c) => c.id.toLowerCase().includes('debit') || c.id === 'dr_amt');
      if (drCol && updatedCells[drCol.id]) {
        updatedCells[drCol.id] = { ...updatedCells[drCol.id], value: '' };
      }
    }
  }

  return updatedCells;
}

export function createBlankRowsForColumns(
  columns: TableColumn[],
  count = 3,
  hasAutoBalance = false
): TableRow[] {
  const today = new Date().toISOString().split('T')[0];
  const rows: TableRow[] = [];

  for (let i = 0; i < count; i++) {
    const rowId = 'r-' + Math.random().toString(36).substring(2, 7);
    const cells: Record<string, TableCell> = {};
    columns.forEach((col, idx) => {
      cells[col.id] = {
        value: col.format === 'date' && idx === 0 && i === 0 ? today : '',
        align: col.align,
        format: col.format,
      };
    });
    rows.push({ id: rowId, cells });
  }

  const hasAutoSumCols = columns.some((c) => c.isAutoSum);
  if (hasAutoSumCols || hasAutoBalance) {
    const totalCells: Record<string, TableCell> = {};
    columns.forEach((col, idx) => {
      if (col.isAutoSum) {
        totalCells[col.id] = {
          value: '0.00',
          align: col.align,
          format: 'currency',
          bold: true,
          doubleUnderline: true,
          isTotal: true,
        };
      } else if (idx === 1 || (idx === 0 && columns.length <= 2)) {
        totalCells[col.id] = {
          value: 'TOTAL',
          align: 'left',
          format: 'text',
          bold: true,
          isTotal: true,
        };
      } else {
        totalCells[col.id] = {
          value: '',
          align: col.align,
          format: 'text',
          isTotal: true,
        };
      }
    });

    rows.push({
      id: 'r_total',
      isTotal: true,
      cells: totalCells,
    });
  }

  return rows;
}

export function createAccountingTable(
  formatType: AccountingFormatType,
  x = 60,
  y = 60,
  currencySymbol = '$'
): AccountingTableObject {
  const meta = ACCOUNTING_FORMAT_CATALOG.find((m) => m.type === formatType) || ACCOUNTING_FORMAT_CATALOG[0];
  const tableId = 'table-' + Math.random().toString(36).substring(2, 9);

  let columns: TableColumn[] = [];
  let rows: TableRow[] = [];

  switch (formatType) {
    case 'journal': {
      columns = [
        { id: 'date', label: 'Date', width: 110, align: 'center', format: 'date' },
        { id: 'particulars', label: 'Particulars / Account Title & Narration', width: 330, align: 'left', format: 'text' },
        { id: 'lf', label: 'L.F.', width: 60, align: 'center', format: 'text' },
        { id: 'debit', label: `Debit (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'credit', label: `Credit (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            date: makeCell('2026-10-01', { align: 'center' }),
            particulars: makeCell('Bank Account Dr.', { bold: true }),
            lf: makeCell('101', { align: 'center' }),
            debit: makeCell('10000.00', { align: 'right', format: 'currency' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            date: makeCell('', { align: 'center' }),
            particulars: makeCell('    To Capital Account', { italic: true }),
            lf: makeCell('301', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('10000.00', { align: 'right', format: 'currency' }),
          },
        },
        {
          id: 'r3',
          cells: {
            date: makeCell('', { align: 'center' }),
            particulars: makeCell('(Being business commenced with cash deposit in bank)', { italic: true, textColor: '#71717a' }),
            lf: makeCell('', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r4',
          cells: {
            date: makeCell('2026-10-02', { align: 'center' }),
            particulars: makeCell('Rent Expense Dr.', { bold: true }),
            lf: makeCell('502', { align: 'center' }),
            debit: makeCell('1200.00', { align: 'right', format: 'currency' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          cells: {
            date: makeCell('', { align: 'center' }),
            particulars: makeCell('    To Bank Account', { italic: true }),
            lf: makeCell('101', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('1200.00', { align: 'right', format: 'currency' }),
          },
        },
        {
          id: 'r6',
          cells: {
            date: makeCell('', { align: 'center' }),
            particulars: makeCell('(Being monthly office rent paid by check)', { italic: true, textColor: '#71717a' }),
            lf: makeCell('', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            date: makeCell('', { align: 'center' }),
            particulars: makeCell('TOTAL', { bold: true }),
            lf: makeCell('', { align: 'center' }),
            debit: makeCell('11200.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            credit: makeCell('11200.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'ledger_t': {
      columns = [
        { id: 'dr_date', label: 'Date (Dr)', width: 95, align: 'center', format: 'date' },
        { id: 'dr_part', label: 'Particulars', width: 200, align: 'left', format: 'text' },
        { id: 'dr_jf', label: 'J.F.', width: 45, align: 'center', format: 'text' },
        { id: 'dr_amt', label: `Amount (${currencySymbol})`, width: 105, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'cr_date', label: 'Date (Cr)', width: 95, align: 'center', format: 'date' },
        { id: 'cr_part', label: 'Particulars', width: 200, align: 'left', format: 'text' },
        { id: 'cr_jf', label: 'J.F.', width: 45, align: 'center', format: 'text' },
        { id: 'cr_amt', label: `Amount (${currencySymbol})`, width: 105, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            dr_date: makeCell('2026-10-01', { align: 'center' }),
            dr_part: makeCell('To Capital A/c'),
            dr_jf: makeCell('J-1', { align: 'center' }),
            dr_amt: makeCell('10000.00', { align: 'right' }),
            cr_date: makeCell('2026-10-02', { align: 'center' }),
            cr_part: makeCell('By Rent A/c'),
            cr_jf: makeCell('J-1', { align: 'center' }),
            cr_amt: makeCell('1200.00', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            dr_date: makeCell('2026-10-05', { align: 'center' }),
            dr_part: makeCell('To Sales A/c'),
            dr_jf: makeCell('J-2', { align: 'center' }),
            dr_amt: makeCell('4500.00', { align: 'right' }),
            cr_date: makeCell('2026-10-31', { align: 'center' }),
            cr_part: makeCell('By Balance c/d', { bold: true }),
            cr_jf: makeCell('', { align: 'center' }),
            cr_amt: makeCell('13300.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            dr_date: makeCell('', { align: 'center' }),
            dr_part: makeCell('TOTAL', { bold: true }),
            dr_jf: makeCell('', { align: 'center' }),
            dr_amt: makeCell('14500.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            cr_date: makeCell('', { align: 'center' }),
            cr_part: makeCell('TOTAL', { bold: true }),
            cr_jf: makeCell('', { align: 'center' }),
            cr_amt: makeCell('14500.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'ledger_running': {
      columns = [
        { id: 'date', label: 'Date', width: 105, align: 'center', format: 'date' },
        { id: 'description', label: 'Particulars / Description', width: 280, align: 'left', format: 'text' },
        { id: 'ref', label: 'Ref', width: 55, align: 'center', format: 'text' },
        { id: 'debit', label: `Debit (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'credit', label: `Credit (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'balance', label: `Balance (${currencySymbol})`, width: 120, align: 'right', format: 'currency' },
        { id: 'drcr', label: 'Dr/Cr', width: 50, align: 'center', format: 'text' },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            date: makeCell('2026-10-01', { align: 'center' }),
            description: makeCell('Opening Balance / Capital Introduction'),
            ref: makeCell('J-1', { align: 'center' }),
            debit: makeCell('10000.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
            balance: makeCell('10000.00', { align: 'right', bold: true }),
            drcr: makeCell('Dr', { align: 'center' }),
          },
        },
        {
          id: 'r2',
          cells: {
            date: makeCell('2026-10-02', { align: 'center' }),
            description: makeCell('Office Rent Expense'),
            ref: makeCell('J-1', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('1200.00', { align: 'right' }),
            balance: makeCell('8800.00', { align: 'right', bold: true }),
            drcr: makeCell('Dr', { align: 'center' }),
          },
        },
        {
          id: 'r3',
          cells: {
            date: makeCell('2026-10-05', { align: 'center' }),
            description: makeCell('Cash Sales Revenue'),
            ref: makeCell('J-2', { align: 'center' }),
            debit: makeCell('4500.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
            balance: makeCell('13300.00', { align: 'right', bold: true }),
            drcr: makeCell('Dr', { align: 'center' }),
          },
        },
      ];
      break;
    }

    case 'trial_balance': {
      columns = [
        { id: 'code', label: 'Code', width: 75, align: 'center', format: 'text' },
        { id: 'title', label: 'Account Title / Head of Account', width: 330, align: 'left', format: 'text' },
        { id: 'lf', label: 'L.F.', width: 60, align: 'center', format: 'text' },
        { id: 'debit', label: `Debit Balance (${currencySymbol})`, width: 140, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'credit', label: `Credit Balance (${currencySymbol})`, width: 140, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            code: makeCell('101', { align: 'center' }),
            title: makeCell('Cash and Bank Balances'),
            lf: makeCell('1', { align: 'center' }),
            debit: makeCell('13300.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            code: makeCell('105', { align: 'center' }),
            title: makeCell('Accounts Receivable'),
            lf: makeCell('2', { align: 'center' }),
            debit: makeCell('6200.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          cells: {
            code: makeCell('120', { align: 'center' }),
            title: makeCell('Merchandise Inventory'),
            lf: makeCell('3', { align: 'center' }),
            debit: makeCell('5000.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r4',
          cells: {
            code: makeCell('201', { align: 'center' }),
            title: makeCell('Accounts Payable'),
            lf: makeCell('4', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('4500.00', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          cells: {
            code: makeCell('301', { align: 'center' }),
            title: makeCell('Capital Account'),
            lf: makeCell('5', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('10000.00', { align: 'right' }),
          },
        },
        {
          id: 'r6',
          cells: {
            code: makeCell('401', { align: 'center' }),
            title: makeCell('Sales Revenue'),
            lf: makeCell('6', { align: 'center' }),
            debit: makeCell('', { align: 'right' }),
            credit: makeCell('11200.00', { align: 'right' }),
          },
        },
        {
          id: 'r7',
          cells: {
            code: makeCell('502', { align: 'center' }),
            title: makeCell('Rent and Utilities Expense'),
            lf: makeCell('7', { align: 'center' }),
            debit: makeCell('1200.00', { align: 'right' }),
            credit: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            code: makeCell('', { align: 'center' }),
            title: makeCell('TOTAL', { bold: true }),
            lf: makeCell('', { align: 'center' }),
            debit: makeCell('25700.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            credit: makeCell('25700.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'balance_sheet': {
      columns = [
        { id: 'liab_part', label: 'Liabilities & Equity', width: 260, align: 'left', format: 'text' },
        { id: 'liab_amt', label: `Amount (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'asset_part', label: 'Assets', width: 260, align: 'left', format: 'text' },
        { id: 'asset_amt', label: `Amount (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            liab_part: makeCell('Owner Capital', { bold: true }),
            liab_amt: makeCell('10000.00', { align: 'right' }),
            asset_part: makeCell('Current Assets:', { bold: true }),
            asset_amt: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            liab_part: makeCell('Add: Net Profit for Period'),
            liab_amt: makeCell('5500.00', { align: 'right' }),
            asset_part: makeCell('  Cash & Cash Equivalents'),
            asset_amt: makeCell('8500.00', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          cells: {
            liab_part: makeCell('Current Liabilities:'),
            liab_amt: makeCell('', { align: 'right' }),
            asset_part: makeCell('  Accounts Receivable'),
            asset_amt: makeCell('6000.00', { align: 'right' }),
          },
        },
        {
          id: 'r4',
          cells: {
            liab_part: makeCell('  Accounts Payable'),
            liab_amt: makeCell('4500.00', { align: 'right' }),
            asset_part: makeCell('Non-Current Assets:'),
            asset_amt: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          cells: {
            liab_part: makeCell('  Accrued Expenses'),
            liab_amt: makeCell('1000.00', { align: 'right' }),
            asset_part: makeCell('  Office Equipment & Furniture'),
            asset_amt: makeCell('6500.00', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            liab_part: makeCell('TOTAL LIABILITIES & EQUITY', { bold: true }),
            liab_amt: makeCell('21000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            asset_part: makeCell('TOTAL ASSETS', { bold: true }),
            asset_amt: makeCell('21000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'income_statement': {
      columns = [
        { id: 'particulars', label: 'Revenue & Expense Items', width: 380, align: 'left', format: 'text' },
        { id: 'note', label: 'Notes', width: 80, align: 'center', format: 'text' },
        { id: 'amount', label: `Amount (${currencySymbol})`, width: 140, align: 'right', format: 'currency' },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            particulars: makeCell('Gross Revenue / Sales', { bold: true }),
            note: makeCell('1', { align: 'center' }),
            amount: makeCell('50000.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r2',
          cells: {
            particulars: makeCell('Less: Cost of Goods Sold (COGS)'),
            note: makeCell('2', { align: 'center' }),
            amount: makeCell('(22000.00)', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          isSubtotal: true,
          cells: {
            particulars: makeCell('GROSS PROFIT', { bold: true }),
            note: makeCell('', { align: 'center' }),
            amount: makeCell('28000.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r4',
          cells: {
            particulars: makeCell('Operating Expenses:', { bold: true }),
            note: makeCell('', { align: 'center' }),
            amount: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          cells: {
            particulars: makeCell('  Salaries & Wages'),
            note: makeCell('3', { align: 'center' }),
            amount: makeCell('(8500.00)', { align: 'right' }),
          },
        },
        {
          id: 'r6',
          cells: {
            particulars: makeCell('  Rent & Occupancy'),
            note: makeCell('', { align: 'center' }),
            amount: makeCell('(3000.00)', { align: 'right' }),
          },
        },
        {
          id: 'r7',
          cells: {
            particulars: makeCell('  Marketing & Promotion'),
            note: makeCell('', { align: 'center' }),
            amount: makeCell('(2500.00)', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            particulars: makeCell('NET INCOME FOR THE PERIOD', { bold: true }),
            note: makeCell('', { align: 'center' }),
            amount: makeCell('14000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'cash_flow': {
      columns = [
        { id: 'activity', label: 'Cash Flow Activities', width: 440, align: 'left', format: 'text' },
        { id: 'amount', label: `Amount (${currencySymbol})`, width: 160, align: 'right', format: 'currency' },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            activity: makeCell('Cash Flows from Operating Activities:', { bold: true }),
            amount: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            activity: makeCell('  Net Income'),
            amount: makeCell('14000.00', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          cells: {
            activity: makeCell('  Adjustments for Non-Cash (Depreciation)'),
            amount: makeCell('1200.00', { align: 'right' }),
          },
        },
        {
          id: 'r4',
          cells: {
            activity: makeCell('  Change in Working Capital'),
            amount: makeCell('(2100.00)', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          isSubtotal: true,
          cells: {
            activity: makeCell('Net Cash from Operating Activities', { bold: true }),
            amount: makeCell('13100.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r6',
          cells: {
            activity: makeCell('Cash Flows from Investing Activities (Equipment Purchase)'),
            amount: makeCell('(4500.00)', { align: 'right' }),
          },
        },
        {
          id: 'r7',
          cells: {
            activity: makeCell('Cash Flows from Financing Activities (Loan Repayment)'),
            amount: makeCell('(2000.00)', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            activity: makeCell('NET INCREASE IN CASH & CASH EQUIVALENTS', { bold: true }),
            amount: makeCell('6600.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'brs': {
      columns = [
        { id: 'particulars', label: 'Particulars', width: 420, align: 'left', format: 'text' },
        { id: 'detail', label: `Details (${currencySymbol})`, width: 130, align: 'right', format: 'currency' },
        { id: 'amount', label: `Amount (${currencySymbol})`, width: 140, align: 'right', format: 'currency' },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            particulars: makeCell('Balance as per Cash Book (Dr)', { bold: true }),
            detail: makeCell('', { align: 'right' }),
            amount: makeCell('12500.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r2',
          cells: {
            particulars: makeCell('Add: Cheques issued but not yet presented for payment', { bold: true }),
            detail: makeCell('3400.00', { align: 'right' }),
            amount: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          cells: {
            particulars: makeCell('Add: Interest credited by bank not recorded in cash book'),
            detail: makeCell('250.00', { align: 'right' }),
            amount: makeCell('3650.00', { align: 'right' }),
          },
        },
        {
          id: 'r4',
          cells: {
            particulars: makeCell('Less: Cheques deposited into bank but not yet cleared', { bold: true }),
            detail: makeCell('(2100.00)', { align: 'right' }),
            amount: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r5',
          cells: {
            particulars: makeCell('Less: Bank charges debited by bank not in cash book'),
            detail: makeCell('(50.00)', { align: 'right' }),
            amount: makeCell('(2150.00)', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            particulars: makeCell('Adjusted Balance as per Bank Pass Book / Statement (Cr)', { bold: true }),
            detail: makeCell('', { align: 'right' }),
            amount: makeCell('14000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'petty_cash': {
      columns = [
        { id: 'receipts', label: `Receipts (${currencySymbol})`, width: 100, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'date', label: 'Date', width: 95, align: 'center', format: 'date' },
        { id: 'vno', label: 'V.No.', width: 55, align: 'center', format: 'text' },
        { id: 'particulars', label: 'Particulars', width: 180, align: 'left', format: 'text' },
        { id: 'total_pay', label: `Total Pay (${currencySymbol})`, width: 100, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'postage', label: 'Postage', width: 85, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'cartage', label: 'Conveyance', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'stationery', label: 'Stationery', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'sundries', label: 'Misc', width: 85, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            receipts: makeCell('500.00', { align: 'right' }),
            date: makeCell('2026-10-01', { align: 'center' }),
            vno: makeCell('', { align: 'center' }),
            particulars: makeCell('To Cash (Imprest Received)'),
            total_pay: makeCell('', { align: 'right' }),
            postage: makeCell('', { align: 'right' }),
            cartage: makeCell('', { align: 'right' }),
            stationery: makeCell('', { align: 'right' }),
            sundries: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            receipts: makeCell('', { align: 'right' }),
            date: makeCell('2026-10-02', { align: 'center' }),
            vno: makeCell('01', { align: 'center' }),
            particulars: makeCell('Courier charges'),
            total_pay: makeCell('45.00', { align: 'right' }),
            postage: makeCell('45.00', { align: 'right' }),
            cartage: makeCell('', { align: 'right' }),
            stationery: makeCell('', { align: 'right' }),
            sundries: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r3',
          cells: {
            receipts: makeCell('', { align: 'right' }),
            date: makeCell('2026-10-04', { align: 'center' }),
            vno: makeCell('02', { align: 'center' }),
            particulars: makeCell('Office notebooks & pens'),
            total_pay: makeCell('80.00', { align: 'right' }),
            postage: makeCell('', { align: 'right' }),
            cartage: makeCell('', { align: 'right' }),
            stationery: makeCell('80.00', { align: 'right' }),
            sundries: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            receipts: makeCell('500.00', { align: 'right', bold: true, isTotal: true }),
            date: makeCell('', { align: 'center' }),
            vno: makeCell('', { align: 'center' }),
            particulars: makeCell('TOTAL PAYMENTS', { bold: true }),
            total_pay: makeCell('125.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            postage: makeCell('45.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            cartage: makeCell('0.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            stationery: makeCell('80.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            sundries: makeCell('0.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'stock_register': {
      columns = [
        { id: 'date', label: 'Date', width: 95, align: 'center', format: 'date' },
        { id: 'rec_qty', label: 'Rec. Qty', width: 75, align: 'right', format: 'number' },
        { id: 'rec_rate', label: 'Rec. Rate', width: 80, align: 'right', format: 'currency' },
        { id: 'rec_amt', label: 'Rec. Amt', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'iss_qty', label: 'Issue Qty', width: 75, align: 'right', format: 'number' },
        { id: 'iss_rate', label: 'Issue Rate', width: 80, align: 'right', format: 'currency' },
        { id: 'iss_amt', label: 'Issue Amt', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'bal_qty', label: 'Bal. Qty', width: 80, align: 'right', format: 'number' },
        { id: 'bal_amt', label: 'Bal. Value', width: 105, align: 'right', format: 'currency' },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            date: makeCell('2026-10-01', { align: 'center' }),
            rec_qty: makeCell('100', { align: 'right' }),
            rec_rate: makeCell('20.00', { align: 'right' }),
            rec_amt: makeCell('2000.00', { align: 'right' }),
            iss_qty: makeCell('', { align: 'right' }),
            iss_rate: makeCell('', { align: 'right' }),
            iss_amt: makeCell('', { align: 'right' }),
            bal_qty: makeCell('100', { align: 'right', bold: true }),
            bal_amt: makeCell('2000.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r2',
          cells: {
            date: makeCell('2026-10-06', { align: 'center' }),
            rec_qty: makeCell('', { align: 'right' }),
            rec_rate: makeCell('', { align: 'right' }),
            rec_amt: makeCell('', { align: 'right' }),
            iss_qty: makeCell('40', { align: 'right' }),
            iss_rate: makeCell('20.00', { align: 'right' }),
            iss_amt: makeCell('800.00', { align: 'right' }),
            bal_qty: makeCell('60', { align: 'right', bold: true }),
            bal_amt: makeCell('1200.00', { align: 'right', bold: true }),
          },
        },
      ];
      break;
    }

    case 'payroll': {
      columns = [
        { id: 'empid', label: 'Emp ID', width: 75, align: 'center', format: 'text' },
        { id: 'name', label: 'Employee Name', width: 170, align: 'left', format: 'text' },
        { id: 'basic', label: `Basic (${currencySymbol})`, width: 100, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'allowance', label: `Allowances (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'gross', label: `Gross Pay (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'deductions', label: `Deductions (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'netpay', label: `Net Salary (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            empid: makeCell('E001', { align: 'center' }),
            name: makeCell('John Anderson'),
            basic: makeCell('4500.00', { align: 'right' }),
            allowance: makeCell('800.00', { align: 'right' }),
            gross: makeCell('5300.00', { align: 'right', bold: true }),
            deductions: makeCell('600.00', { align: 'right' }),
            netpay: makeCell('4700.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r2',
          cells: {
            empid: makeCell('E002', { align: 'center' }),
            name: makeCell('Sarah Jenkins'),
            basic: makeCell('5200.00', { align: 'right' }),
            allowance: makeCell('950.00', { align: 'right' }),
            gross: makeCell('6150.00', { align: 'right', bold: true }),
            deductions: makeCell('750.00', { align: 'right' }),
            netpay: makeCell('5400.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            empid: makeCell('', { align: 'center' }),
            name: makeCell('TOTAL PAYROLL', { bold: true }),
            basic: makeCell('9700.00', { align: 'right', bold: true, isTotal: true }),
            allowance: makeCell('1750.00', { align: 'right', bold: true, isTotal: true }),
            gross: makeCell('11450.00', { align: 'right', bold: true, isTotal: true }),
            deductions: makeCell('1350.00', { align: 'right', bold: true, isTotal: true }),
            netpay: makeCell('10100.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }

    case 'ar_aging': {
      columns = [
        { id: 'customer', label: 'Customer / Client', width: 200, align: 'left', format: 'text' },
        { id: 'inv_num', label: 'Invoice #', width: 90, align: 'center', format: 'text' },
        { id: 'inv_date', label: 'Date', width: 95, align: 'center', format: 'date' },
        { id: 'total', label: `Total (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'c_0_30', label: '0-30 Days', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'c_31_60', label: '31-60 Days', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'c_61_90', label: '61-90 Days', width: 95, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'c_90_plus', label: '90+ Days', width: 95, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            customer: makeCell('Apex Enterprises'),
            inv_num: makeCell('INV-104', { align: 'center' }),
            inv_date: makeCell('2026-09-15', { align: 'center' }),
            total: makeCell('3400.00', { align: 'right', bold: true }),
            c_0_30: makeCell('3400.00', { align: 'right' }),
            c_31_60: makeCell('', { align: 'right' }),
            c_61_90: makeCell('', { align: 'right' }),
            c_90_plus: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            customer: makeCell('Bright Global Corp'),
            inv_num: makeCell('INV-088', { align: 'center' }),
            inv_date: makeCell('2026-08-01', { align: 'center' }),
            total: makeCell('5200.00', { align: 'right', bold: true }),
            c_0_30: makeCell('', { align: 'right' }),
            c_31_60: makeCell('5200.00', { align: 'right' }),
            c_61_90: makeCell('', { align: 'right' }),
            c_90_plus: makeCell('', { align: 'right' }),
          },
        },
      ];
      break;
    }

    case 'ap_ledger': {
      columns = [
        { id: 'vendor', label: 'Vendor / Supplier', width: 220, align: 'left', format: 'text' },
        { id: 'bill_no', label: 'Bill #', width: 95, align: 'center', format: 'text' },
        { id: 'due_date', label: 'Due Date', width: 100, align: 'center', format: 'date' },
        { id: 'total', label: `Total Due (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'paid', label: `Paid (${currencySymbol})`, width: 110, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'balance', label: `Balance (${currencySymbol})`, width: 120, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            vendor: makeCell('Tech Supply Depot'),
            bill_no: makeCell('B-4401', { align: 'center' }),
            due_date: makeCell('2026-10-20', { align: 'center' }),
            total: makeCell('2400.00', { align: 'right' }),
            paid: makeCell('1400.00', { align: 'right' }),
            balance: makeCell('1000.00', { align: 'right', bold: true }),
          },
        },
        {
          id: 'r2',
          cells: {
            vendor: makeCell('Standard Office Leasing'),
            bill_no: makeCell('B-902', { align: 'center' }),
            due_date: makeCell('2026-10-31', { align: 'center' }),
            total: makeCell('3000.00', { align: 'right' }),
            paid: makeCell('3000.00', { align: 'right' }),
            balance: makeCell('0.00', { align: 'right', bold: true }),
          },
        },
      ];
      break;
    }

    case 'custom_table':
    default: {
      columns = [
        { id: 'col1', label: 'Item / Account', width: 240, align: 'left', format: 'text' },
        { id: 'col2', label: 'Reference / Code', width: 120, align: 'center', format: 'text' },
        { id: 'col3', label: `Debit (${currencySymbol})`, width: 130, align: 'right', format: 'currency', isAutoSum: true },
        { id: 'col4', label: `Credit (${currencySymbol})`, width: 130, align: 'right', format: 'currency', isAutoSum: true },
      ];
      rows = [
        {
          id: 'r1',
          cells: {
            col1: makeCell('Sample Entry 1'),
            col2: makeCell('REF-01', { align: 'center' }),
            col3: makeCell('1000.00', { align: 'right' }),
            col4: makeCell('', { align: 'right' }),
          },
        },
        {
          id: 'r2',
          cells: {
            col1: makeCell('Sample Entry 2'),
            col2: makeCell('REF-02', { align: 'center' }),
            col3: makeCell('', { align: 'right' }),
            col4: makeCell('1000.00', { align: 'right' }),
          },
        },
        {
          id: 'r_total',
          isTotal: true,
          cells: {
            col1: makeCell('TOTAL', { bold: true }),
            col2: makeCell('', { align: 'center' }),
            col3: makeCell('1000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
            col4: makeCell('1000.00', { align: 'right', bold: true, doubleUnderline: true, isTotal: true }),
          },
        },
      ];
      break;
    }
  }

  // All templates start with clean, blank rows ready for immediate typing without dummy clutter!
  rows = createBlankRowsForColumns(columns, 3, !!meta.hasAutoBalance);

  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const totalHeight = 36 + (rows.length * 30) + 40; // header + rows + title space

  return {
    id: tableId,
    pageId: null,
    type: 'table',
    formatType,
    layerId: 'layer-tables',
    x,
    y,
    width: totalWidth,
    height: totalHeight,
    title: meta.defaultTitle,
    columns,
    rows,
    currencySymbol,
    showAutoTotals: true,
    showBalancedIndicator: !!meta.hasAutoBalance,
    headerBgColor: '#f1f5f9',
    headerTextColor: '#0f172a',
    bgColor: '#ffffff',
    textColor: '#0f172a',
    borderStyle: 'grid',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deviceId: 'local',
  };
}

/**
 * Calculates sum for numeric cells in a column.
 */
export function calculateColumnSum(table: AccountingTableObject, columnId: string): number {
  let sum = 0;
  for (const row of table.rows) {
    if (row.isTotal) continue;
    const cell = row.cells[columnId];
    if (!cell || !cell.value) continue;
    // Strip parens, commas, symbols
    let raw = cell.value.trim().replace(/[$,₹,€,£,\s]/g, '');
    let isNeg = false;
    if (raw.startsWith('(') && raw.endsWith(')')) {
      isNeg = true;
      raw = raw.slice(1, -1);
    }
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      sum += isNeg ? -val : val;
    }
  }
  return sum;
}

/**
 * Computes balance status for Journal, Ledger, Trial Balance, etc.
 */
export function evaluateTableBalance(table: AccountingTableObject): {
  isBalanced: boolean;
  debitTotal: number;
  creditTotal: number;
  difference: number;
} | null {
  if (!table.showBalancedIndicator) return null;

  let drCol = table.columns.find((c) => c.id.toLowerCase().includes('debit') || c.id === 'dr_amt');
  let crCol = table.columns.find((c) => c.id.toLowerCase().includes('credit') || c.id === 'cr_amt');

  // Fallback for Balance Sheet: liab_amt vs asset_amt
  if (!drCol && table.formatType === 'balance_sheet') {
    drCol = table.columns.find((c) => c.id === 'asset_amt');
    crCol = table.columns.find((c) => c.id === 'liab_amt');
  }

  if (!drCol || !crCol) return null;

  const drSum = calculateColumnSum(table, drCol.id);
  const crSum = calculateColumnSum(table, crCol.id);
  const diff = Math.abs(drSum - crSum);

  return {
    isBalanced: diff < 0.009,
    debitTotal: drSum,
    creditTotal: crSum,
    difference: diff,
  };
}

/**
 * Recalculates total row values in place
 */
export function recalculateTableAutoSums(table: AccountingTableObject): AccountingTableObject {
  const totalRow = table.rows.find((r) => r.isTotal);
  if (!totalRow) return table;

  const newTotalCells = { ...totalRow.cells };

  table.columns.forEach((col) => {
    if (col.isAutoSum) {
      const sum = calculateColumnSum(table, col.id);
      newTotalCells[col.id] = {
        ...(newTotalCells[col.id] || {}),
        value: sum.toFixed(2),
        bold: true,
        align: col.align,
        doubleUnderline: true,
        isTotal: true,
      };
    }
  });

  return {
    ...table,
    rows: table.rows.map((r) => (r.isTotal ? { ...r, cells: newTotalCells } : r)),
    updatedAt: Date.now(),
  };
}
