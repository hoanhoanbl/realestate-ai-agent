import { Property } from './entities/property.entity';

// Ảnh từ Unsplash (giấy phép Unsplash, dùng miễn phí), cắt sẵn 1200x800
const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=800&q=75`;

type SampleProperty = Omit<Property, 'id'> & { imageUrl: string; description: string };

// 10 căn mẫu: seed khi bảng trống, và điền bù ảnh/mô tả theo tên khi DB đã có sẵn
export const SAMPLE_PROPERTIES: SampleProperty[] = [
  {
    name: 'Căn hộ Vinhomes Grand Park 2PN',
    address: 'Đường Nguyễn Xiển, Long Thạnh Mỹ, Quận 9, TP.HCM',
    price: 2800000000,
    area: 65.5,
    type: 'APARTMENT',
    status: 'AVAILABLE',
    imageUrl: unsplash('1522708323590-d24dbb6b0267'),
    description:
      'Căn 2 phòng ngủ, 2 WC, ban công hướng Đông Nam đón gió. Nội thất cơ bản, có thể dọn vào ở ngay. ' +
      'Nội khu có công viên 36 ha, hồ bơi, trường học và siêu thị. Phù hợp gia đình trẻ hoặc mua để cho thuê.',
  },
  {
    name: 'Căn hộ Masteri Thảo Điền 3PN',
    address: '159 Xa Lộ Hà Nội, Thảo Điền, Quận 2, TP.HCM',
    price: 5200000000,
    area: 90.0,
    type: 'APARTMENT',
    status: 'AVAILABLE',
    imageUrl: unsplash('1628592102751-ba83b0314276'),
    description:
      'Căn góc 3 phòng ngủ, view sông Sài Gòn, nội thất đầy đủ. Kết nối trực tiếp ga metro Thảo Điền ' +
      'và Vincom Mega Mall. Sổ hồng lâu dài, phí quản lý hợp lý.',
  },
  {
    name: 'Nhà phố Sun Group Đà Nẵng',
    address: 'Đường Nam Kỳ Khởi Nghĩa, Ngũ Hành Sơn, Đà Nẵng',
    price: 4500000000,
    area: 120.0,
    type: 'TOWNHOUSE',
    status: 'AVAILABLE',
    imageUrl: unsplash('1721815693498-cc28507c0ba2'),
    description:
      'Nhà phố 3 tầng thiết kế hiện đại, mặt tiền 6 m, gara ô tô. Cách biển Mỹ Khê khoảng 5 phút lái xe. ' +
      'Vừa để ở vừa kinh doanh tầng trệt.',
  },
  {
    name: 'Biệt thự Ocean Villa Đà Nẵng',
    address: 'Đường Trường Sa, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng',
    price: 15000000000,
    area: 350.0,
    type: 'VILLA',
    status: 'AVAILABLE',
    imageUrl: unsplash('1613977257365-aaae5a9817ff'),
    description:
      'Biệt thự biển có hồ bơi riêng, sân vườn rộng, 4 phòng ngủ. Khu compound an ninh 24/7, ' +
      'đã có đơn vị vận hành cho thuê nghỉ dưỡng nếu chủ nhà cần.',
  },
  {
    name: 'Căn hộ Landmark 81 Luxury',
    address: '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM',
    price: 8500000000,
    area: 82.0,
    type: 'APARTMENT',
    status: 'AVAILABLE',
    imageUrl: unsplash('1545324418-cc1a3fa10c00'),
    description:
      'Căn hộ hạng sang tầng cao, view toàn cảnh sông và trung tâm Quận 1. Bàn giao nội thất cao cấp, ' +
      'tiện ích khách sạn 5 sao: hồ bơi vô cực, gym, trung tâm thương mại dưới chân tòa nhà.',
  },
  {
    name: 'Nhà riêng Nguyễn Trãi Hà Nội',
    address: 'Đường Nguyễn Trãi, Thanh Xuân, Hà Nội',
    price: 6800000000,
    area: 75.0,
    type: 'TOWNHOUSE',
    status: 'AVAILABLE',
    imageUrl: unsplash('1625283518755-6047df2fb180'),
    description:
      'Nhà 5 tầng, ngõ ô tô tránh, cách mặt đường Nguyễn Trãi 30 m. Gần các trường đại học và tuyến ' +
      'đường sắt trên cao Cát Linh - Hà Đông. Sổ đỏ chính chủ.',
  },
  {
    name: 'Căn hộ Sun Grand City Tây Hồ',
    address: '69B Thụy Khuê, Tây Hồ, Hà Nội',
    price: 7200000000,
    area: 95.0,
    type: 'APARTMENT',
    status: 'AVAILABLE',
    imageUrl: unsplash('1603072845032-7b5bd641a82a'),
    description:
      'Căn 3 phòng ngủ view Hồ Tây, thiết kế sáng và thoáng. Nội khu yên tĩnh, có hồ bơi bốn mùa ' +
      'và khu vui chơi trẻ em. Phù hợp gia đình muốn ở lâu dài gần trung tâm.',
  },
  {
    name: 'Shophouse Phú Quốc Grand World',
    address: 'Gành Dầu, Phú Quốc, Kiên Giang',
    price: 9800000000,
    area: 110.0,
    type: 'SHOPHOUSE',
    status: 'AVAILABLE',
    imageUrl: unsplash('1665340826159-2456e3ad6b19'),
    description:
      'Shophouse mặt phố đi bộ trong "thành phố không ngủ" Grand World, lượng khách du lịch đông quanh năm. ' +
      'Tầng trệt kinh doanh, các tầng trên ở hoặc làm homestay.',
  },
  {
    name: 'Đất nền Khu đô thị Nam Hòa Xuân',
    address: 'Hòa Xuân, Cẩm Lệ, Đà Nẵng',
    price: 3200000000,
    area: 100.0,
    type: 'LAND',
    status: 'AVAILABLE',
    imageUrl: unsplash('1747854805840-9be7d5e360e6'),
    description:
      'Lô đất 5 x 20 m trong khu đô thị đã hoàn thiện hạ tầng, đường 7,5 m. Gần sông Cổ Cò ' +
      'và cầu Hòa Xuân, xây ở hoặc đầu tư đều phù hợp. Pháp lý sổ đỏ từng lô.',
  },
  {
    name: 'Căn hộ Studio Vinhomes Ocean Park',
    address: 'Đa Tốn, Gia Lâm, Hà Nội',
    price: 1600000000,
    area: 32.0,
    type: 'APARTMENT',
    status: 'AVAILABLE',
    imageUrl: unsplash('1502672260266-1c1ef2d93688'),
    description:
      'Studio 32 m² gọn gàng, đủ nội thất, phù hợp người độc thân hoặc mua cho thuê. ' +
      'Nội khu có biển hồ nước mặn, trường đại học VinUni và nhiều tiện ích đi bộ.',
  },
];
