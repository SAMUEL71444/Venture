// Tabel generik dipakai halaman Verify & Trust (verifikasi, escrow, laporan,
// riwayat pengguna, kualitas) — satu komponen, kolom & datanya lewat props,
// BUKAN tabel baru tiap halaman. Di layar sempit (≤760px) berubah jadi
// tumpukan kartu lewat CSS `data-label` (lihat app/globals.css), bukan
// markup terpisah.
//
// columns: [{ key, label, render?(row), align? }]
export default function DataTable({ columns, rows, onRowClick, empty = "Tidak ada data." }) {
  if (!rows || rows.length === 0) {
    return <div className="empty-state">{empty}</div>;
  }

  return (
    <div className="data-table-wrap">
      <table className="simple-table data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className={onRowClick ? "clickable" : ""} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} style={c.align ? { textAlign: c.align } : undefined}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
