const vatTuData = [
    { id: 1, ma_vach: "12345" }
];

const newItems = [
    { ma_vach: "12345" }, // duplicate in app
    { ma_vach: "67890" }, // duplicate in excel
    { ma_vach: "67890" }  // duplicate in excel
];

const excelBarcodes = new Set();
const excelDuplicates = new Set();
const appDuplicates = new Set();

for (const item of newItems) {
    if (!item.ma_vach) continue;
    
    const barcode = String(item.ma_vach).trim().toLowerCase();

    // 1. Check duplicate inside the Excel file
    if (excelBarcodes.has(barcode)) {
        excelDuplicates.add(item.ma_vach);
    } else {
        excelBarcodes.add(barcode);
    }

    // 2. Check duplicate compared to app data (vatTuData)
    const isDupInApp = vatTuData.some(existing => 
        existing.ma_vach && String(existing.ma_vach).trim().toLowerCase() === barcode
    );
    if (isDupInApp) {
        appDuplicates.add(item.ma_vach);
    }
}

let errorMsg = '';
if (excelDuplicates.size > 0) {
    errorMsg += `<b style="color: #ef4444;">Trùng lặp bên trong file Excel:</b><br>${Array.from(excelDuplicates).join(', ')}<br><br>`;
}
if (appDuplicates.size > 0) {
    errorMsg += `<b style="color: #ef4444;">Đã tồn tại trên phần mềm:</b><br>${Array.from(appDuplicates).join(', ')}`;
}

console.log("Error Msg:", errorMsg);
