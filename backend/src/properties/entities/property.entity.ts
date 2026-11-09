import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Một phòng xem 360°: tên phòng và link ảnh toàn cảnh (equirectangular, tỉ lệ 2:1)
export interface PanoramaRoom {
  title: string;
  url: string;
}

// Một địa điểm quanh nhà: nhóm (NEARBY_CATEGORIES), tên và khoảng cách ghi tự do ("500 m", "5 phút đi bộ")
export interface NearbyPlace {
  category: string;
  name: string;
  distance: string;
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column('bigint')
  price: number;

  @Column('decimal')
  area: number;

  @Column()
  type: string;

  @Column()
  status: string;

  // Link ảnh đại diện (http/https). Trống thì web hiện nền theo loại nhà
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  // Mô tả cho khách đọc, sau này dùng làm nguồn cho RAG
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Các phòng xem 360° theo thứ tự hiện cho khách. null = chưa từng nhập, [] = quản lý đã xoá hết
  @Column({ type: 'jsonb', nullable: true })
  panoramas: PanoramaRoom[] | null;

  // --- Thông tin chi tiết (FE-31). Trống = không hiện ở trang khách ---

  @Column({ type: 'int', nullable: true })
  bedrooms: number | null;

  @Column({ type: 'int', nullable: true })
  bathrooms: number | null;

  // Số tầng của nhà; với căn hộ là tầng của căn
  @Column({ type: 'int', nullable: true })
  floors: number | null;

  // Diện tích đất và diện tích sàn (m²), chủ yếu cho nhà phố, biệt thự. `area` vẫn là diện tích chính
  @Column({ name: 'land_area', type: 'decimal', nullable: true })
  landArea: number | null;

  @Column({ name: 'floor_area', type: 'decimal', nullable: true })
  floorArea: number | null;

  // Đường hoặc hẻm trước nhà (m)
  @Column({ name: 'road_width', type: 'decimal', nullable: true })
  roadWidth: number | null;

  // Mã trong property-options.ts
  @Column({ type: 'varchar', nullable: true })
  direction: string | null;

  @Column({ name: 'legal_status', type: 'varchar', nullable: true })
  legalStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  furnishing: string | null;

  @Column({ type: 'varchar', nullable: true })
  occupancy: string | null;

  // Ảnh thêm ngoài ảnh đại diện, theo thứ tự hiện. null = chưa từng nhập, [] = đã xoá hết (dùng chung cho các mảng dưới)
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  // Tiện ích của căn, ví dụ "Ban công", "Chỗ đậu ô tô"
  @Column({ type: 'jsonb', nullable: true })
  features: string[] | null;

  // Nội thất bàn giao, ví dụ "Sofa", "Tủ lạnh"
  @Column({ type: 'jsonb', nullable: true })
  furniture: string[] | null;

  // Dịch vụ xung quanh
  @Column({ type: 'jsonb', nullable: true })
  nearby: NearbyPlace[] | null;
}