export async function downloadExcel(
  filename: string,
  sheetName: string,
  rows: string[][],
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs")

  const workbook = new ExcelJS.Workbook()

  const worksheet = workbook.addWorksheet(sheetName)

  worksheet.addRows(rows)

  worksheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()

  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )

  const link = document.createElement("a")

  link.href = url

  link.download = filename

  link.click()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
