import Icon from "@/components/Icon";

// Thumbnail karya portofolio tanpa aset gambar: gradient dari warna
// avatar talent + ikon + judul. Dipakai kartu hasil pencarian dan tab
// Portofolio di panel detail, jadi tampilannya konsisten.
export default function TalentThumb({ color, item, size }) {
  return (
    <div
      className="ft-thumb"
      style={{ background: `linear-gradient(135deg, ${color} 0%, #FFFFFF 140%)`, ...(size ? { width: size } : {}) }}
    >
      <Icon name={item.icon} />
      <span>{item.title}</span>
    </div>
  );
}
