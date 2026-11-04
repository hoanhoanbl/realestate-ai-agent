import { NearbyPlace, PanoramaRoom, Property } from './entities/property.entity';

// Ảnh từ Unsplash (giấy phép Unsplash, dùng miễn phí), cắt sẵn 1200x800
const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=800&q=75`;

// Ảnh 360° mẫu từ Poly Haven (giấy phép CC0, dùng tự do; máy chủ cho phép web khác tải). Mỗi ảnh khoảng 3 MB
const polyhaven = (name: string) =>
  `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${name}.jpg`;

const place = (category: string, name: string, distance: string): NearbyPlace => ({ category, name, distance });

type Details = Partial<
  Pick<
    Property,
    | 'bedrooms'
    | 'bathrooms'
    | 'floors'
    | 'landArea'
    | 'floorArea'
    | 'roadWidth'
    | 'direction'
    | 'legalStatus'
    | 'furnishing'
    | 'occupancy'
  >
>;

export type SampleProperty = Pick<Property, 'name' | 'address' | 'price' | 'area' | 'type' | 'status'> &
  Details & {
    imageUrl: string;
    description: string;
    // Mô tả mẫu trước FE-31: căn nào còn đúng mô tả này thì được thay bằng mô tả mới khi điền bù
    legacyDescription?: string;
    panoramas?: PanoramaRoom[];
    images?: string[];
    features?: string[];
    furniture?: string[];
    nearby?: NearbyPlace[];
  };

// Căn mẫu: seed khi bảng trống, và điền bù theo tên khi DB đã có sẵn. Số liệu và địa điểm xung quanh chỉ để demo
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
      'Căn 2 phòng ngủ ở tầng trung, ban công hướng Đông Nam nên sáng sớm có nắng nhẹ, chiều mát. ' +
      'Phòng khách liền bếp, hai phòng ngủ đều có cửa sổ, phòng ngủ chính có WC riêng.\n\n' +
      'Căn bàn giao nội thất cơ bản (tủ bếp, điều hòa, tủ âm tường), dọn vào ở ngay. Nội khu có công viên lớn, ' +
      'hồ bơi, trường học và siêu thị trong bán kính đi bộ. Phù hợp gia đình trẻ hoặc mua để cho thuê.',
    legacyDescription:
      'Căn 2 phòng ngủ, 2 WC, ban công hướng Đông Nam đón gió. Nội thất cơ bản, có thể dọn vào ở ngay. ' +
      'Nội khu có công viên 36 ha, hồ bơi, trường học và siêu thị. Phù hợp gia đình trẻ hoặc mua để cho thuê.',
    bedrooms: 2,
    bathrooms: 2,
    floors: 18,
    direction: 'DONG_NAM',
    legalStatus: 'SO_HONG',
    furnishing: 'BASIC',
    occupancy: 'VACANT',
    images: [
      unsplash('1583847268964-b28dc8f51f92'),
      unsplash('1615874959474-d609969a20ed'),
      unsplash('1600489000022-c2086d79f9d4'),
      unsplash('1584622650111-993a426fbf0a'),
      unsplash('1774685110793-e427dfa87467'),
    ],
    features: ['Ban công', 'Thang máy', 'Hồ bơi nội khu', 'Phòng gym', 'Công viên nội khu', 'An ninh 24/7', 'Hầm gửi xe'],
    furniture: ['Tủ bếp', 'Bếp điện', 'Máy hút mùi', 'Điều hòa', 'Tủ quần áo âm tường', 'Rèm cửa'],
    nearby: [
      place('PARK', 'Công viên trung tâm nội khu', '300 m'),
      place('SCHOOL', 'Trường liên cấp Vinschool', '500 m'),
      place('MALL', 'Vincom Mega Mall Grand Park', '700 m'),
      place('HOSPITAL', 'Bệnh viện TP Thủ Đức', '7 km'),
      place('TRANSPORT', 'Ga metro Suối Tiên', '5 km'),
    ],
    panoramas: [
      { title: 'Phòng khách', url: polyhaven('lebombo') },
      { title: 'Phòng ngủ', url: polyhaven('hotel_room') },
      { title: 'Phòng tắm', url: polyhaven('modern_bathroom') },
    ],
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
      'Căn góc 3 phòng ngủ, hai mặt thoáng, phòng khách và phòng ngủ chính nhìn ra sông Sài Gòn. ' +
      'Bố trí 3 phòng ngủ, 2 WC, bếp tách khỏi phòng khách nên không ám mùi.\n\n' +
      'Nội thất đầy đủ, chủ nhà để lại toàn bộ đồ điện tử và đồ gỗ. Tòa nhà nối thẳng ga metro Thảo Điền ' +
      'và Vincom Mega Mall. Sổ hồng lâu dài, phí quản lý hợp lý.',
    legacyDescription:
      'Căn góc 3 phòng ngủ, view sông Sài Gòn, nội thất đầy đủ. Kết nối trực tiếp ga metro Thảo Điền ' +
      'và Vincom Mega Mall. Sổ hồng lâu dài, phí quản lý hợp lý.',
    bedrooms: 3,
    bathrooms: 2,
    floors: 22,
    direction: 'TAY_NAM',
    legalStatus: 'SO_HONG',
    furnishing: 'FULL',
    occupancy: 'VACANT',
    images: [
      unsplash('1759691555393-60cd5355d840'),
      unsplash('1616594039964-ae9021a400a0'),
      unsplash('1556911220-bff31c812dba'),
      unsplash('1763485956310-55f3c0e822d5'),
      unsplash('1776363116182-51694a04a1d5'),
    ],
    features: ['Căn góc', 'View sông', 'Ban công', 'Thang máy', 'Hồ bơi', 'Phòng gym', 'An ninh 24/7', 'Chỗ đậu ô tô'],
    furniture: ['Sofa', 'Bàn ăn', 'Giường', 'Tủ quần áo', 'Tủ lạnh', 'Máy giặt', 'Điều hòa', 'Tivi', 'Bếp từ'],
    nearby: [
      place('TRANSPORT', 'Ga metro Thảo Điền', '200 m'),
      place('MALL', 'Vincom Mega Mall Thảo Điền', '300 m'),
      place('HOSPITAL', 'Bệnh viện Quốc tế Mỹ (AIH)', '1,5 km'),
      place('SCHOOL', 'Các trường quốc tế khu Thảo Điền', '1 km'),
      place('PARK', 'Công viên ven sông Sài Gòn', '800 m'),
    ],
    panoramas: [
      { title: 'Phòng khách', url: polyhaven('cayley_interior') },
      { title: 'Phòng ngủ', url: polyhaven('hotel_room') },
      { title: 'Phòng tắm', url: polyhaven('modern_bathroom') },
    ],
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
      'Nhà phố 3 tầng thiết kế hiện đại, mặt tiền 6 m, đường trước nhà rộng 10,5 m, ô tô vào tận gara. ' +
      'Tầng trệt để trống làm cửa hàng hoặc văn phòng, tầng 2 và 3 gồm 4 phòng ngủ, mỗi phòng có WC riêng, sân thượng phơi đồ.\n\n' +
      'Cách biển Mỹ Khê khoảng 5 phút lái xe, gần chợ và trường học. Vừa để ở vừa kinh doanh tầng trệt.',
    legacyDescription:
      'Nhà phố 3 tầng thiết kế hiện đại, mặt tiền 6 m, gara ô tô. Cách biển Mỹ Khê khoảng 5 phút lái xe. ' +
      'Vừa để ở vừa kinh doanh tầng trệt.',
    bedrooms: 4,
    bathrooms: 4,
    floors: 3,
    landArea: 120,
    floorArea: 300,
    roadWidth: 10.5,
    direction: 'DONG',
    legalStatus: 'SO_HONG',
    furnishing: 'BASIC',
    occupancy: 'VACANT',
    images: [
      unsplash('1580587771525-78b9dba3b914'),
      unsplash('1560448204-e02f11c3d0e2'),
      unsplash('1616486029423-aaa4789e8c9a'),
      unsplash('1617228069096-4638a7ffc906'),
    ],
    features: ['Mặt tiền kinh doanh', 'Gara ô tô', 'Ban công', 'Sân thượng'],
    furniture: ['Tủ bếp', 'Điều hòa', 'Bình nóng lạnh'],
    nearby: [
      place('OTHER', 'Biển Mỹ Khê', '3 km'),
      place('MARKET', 'Chợ Bắc Mỹ An', '1,5 km'),
      place('SCHOOL', 'Trường tiểu học trong phường', '600 m'),
      place('HOSPITAL', 'Trung tâm y tế quận Ngũ Hành Sơn', '2 km'),
    ],
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
      'Biệt thự biển 2 tầng trên lô đất 350 m², hồ bơi riêng giữa sân vườn, phòng khách mở thẳng ra hồ bơi. ' +
      '4 phòng ngủ đều có WC riêng, phòng ngủ chính có ban công nhìn ra biển.\n\n' +
      'Khu compound có bảo vệ 24/7, cách bãi biển vài phút đi bộ. Nội thất đầy đủ, đã có đơn vị vận hành ' +
      'cho thuê nghỉ dưỡng nếu chủ nhà cần.',
    legacyDescription:
      'Biệt thự biển có hồ bơi riêng, sân vườn rộng, 4 phòng ngủ. Khu compound an ninh 24/7, ' +
      'đã có đơn vị vận hành cho thuê nghỉ dưỡng nếu chủ nhà cần.',
    bedrooms: 4,
    bathrooms: 5,
    floors: 2,
    landArea: 350,
    floorArea: 420,
    roadWidth: 7.5,
    direction: 'DONG_NAM',
    legalStatus: 'SO_HONG',
    furnishing: 'FULL',
    occupancy: 'VACANT',
    images: [
      unsplash('1613490493576-7fde63acd811'),
      unsplash('1596178067639-5c6e68aea6dc'),
      unsplash('1721989518229-3e84837fc398'),
      unsplash('1616047006789-b7af5afb8c20'),
      unsplash('1560185893-a55cbc8c57e8'),
      unsplash('1786053538161-501fbdd89629'),
      unsplash('1781344334947-60c704bafd51'),
    ],
    features: ['Hồ bơi riêng', 'Sân vườn', 'Gara ô tô', 'Ban công', 'Sân thượng', 'An ninh 24/7'],
    furniture: [
      'Sofa',
      'Bàn ăn',
      'Giường',
      'Tủ quần áo',
      'Tủ lạnh',
      'Máy giặt',
      'Điều hòa',
      'Tivi',
      'Bếp từ',
      'Ghế hồ bơi',
    ],
    nearby: [
      place('OTHER', 'Bãi biển Non Nước', '300 m'),
      place('PARK', 'Danh thắng Ngũ Hành Sơn', '3 km'),
      place('MARKET', 'Siêu thị trong khu đô thị', '1 km'),
      place('TRANSPORT', 'Sân bay Đà Nẵng', '12 km'),
    ],
    panoramas: [
      { title: 'Phòng khách', url: polyhaven('kiara_interior') },
      { title: 'Phòng sinh hoạt chung', url: polyhaven('lythwood_room') },
      { title: 'Phòng đọc sách', url: polyhaven('reading_room') },
    ],
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
      'Căn hộ hạng sang tầng 45, kính trần đến sàn, nhìn toàn cảnh sông Sài Gòn và trung tâm Quận 1. ' +
      'Gồm 2 phòng ngủ, 2 WC, bếp mở có đảo bếp.\n\n' +
      'Bàn giao nội thất cao cấp. Cư dân dùng tiện ích tiêu chuẩn khách sạn 5 sao: hồ bơi vô cực, gym, ' +
      'trung tâm thương mại ngay dưới chân tòa nhà, công viên ven sông.',
    legacyDescription:
      'Căn hộ hạng sang tầng cao, view toàn cảnh sông và trung tâm Quận 1. Bàn giao nội thất cao cấp, ' +
      'tiện ích khách sạn 5 sao: hồ bơi vô cực, gym, trung tâm thương mại dưới chân tòa nhà.',
    bedrooms: 2,
    bathrooms: 2,
    floors: 45,
    direction: 'DONG',
    legalStatus: 'SO_HONG',
    furnishing: 'FULL',
    occupancy: 'VACANT',
    images: [
      unsplash('1773578978637-c9771e7a9913'),
      unsplash('1778731525620-ae459167c176'),
      unsplash('1785535573585-8f962fa3cda5'),
      unsplash('1661107259637-4e1c55462428'),
    ],
    features: ['View sông', 'Thang máy', 'Hồ bơi vô cực', 'Phòng gym', 'An ninh 24/7', 'Chỗ đậu ô tô'],
    furniture: ['Sofa', 'Bàn ăn', 'Giường', 'Tủ quần áo', 'Tủ lạnh', 'Máy giặt', 'Điều hòa', 'Tivi', 'Bếp từ', 'Máy rửa bát'],
    nearby: [
      place('MALL', 'Vincom Center Landmark 81', 'Dưới chân tòa nhà'),
      place('PARK', 'Công viên Vinhomes Central Park', '200 m'),
      place('HOSPITAL', 'Bệnh viện Vinmec Central Park', '400 m'),
      place('SCHOOL', 'Trường Vinschool Central Park', '500 m'),
      place('TRANSPORT', 'Ga metro Văn Thánh', '1 km'),
    ],
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
      'Nhà 5 tầng xây kiên cố, ngõ ô tô tránh, cách mặt đường Nguyễn Trãi 30 m. Tầng 1 để xe và bếp, ' +
      'tầng 2 phòng khách và một phòng ngủ, tầng 3 đến 5 mỗi tầng một phòng ngủ có WC, trên cùng là sân thượng.\n\n' +
      'Chủ nhà đang ở, giao nhà sau khi ký hợp đồng 1 tháng. Gần các trường đại học, chợ Thượng Đình ' +
      'và ga tàu trên cao Cát Linh - Hà Đông. Sổ đỏ chính chủ.',
    legacyDescription:
      'Nhà 5 tầng, ngõ ô tô tránh, cách mặt đường Nguyễn Trãi 30 m. Gần các trường đại học và tuyến ' +
      'đường sắt trên cao Cát Linh - Hà Đông. Sổ đỏ chính chủ.',
    bedrooms: 4,
    bathrooms: 5,
    floors: 5,
    landArea: 75,
    floorArea: 330,
    roadWidth: 5,
    direction: 'NAM',
    legalStatus: 'SO_DO',
    furnishing: 'BASIC',
    occupancy: 'OWNER_LIVING',
    images: [
      unsplash('1605297507265-a46432d9c44d'),
      unsplash('1585128792020-803d29415281'),
      unsplash('1512918728675-ed5a9ecdebfd'),
      unsplash('1622372738946-62e02505feb3'),
    ],
    features: ['Ngõ ô tô', 'Ban công', 'Sân thượng'],
    furniture: ['Tủ bếp', 'Điều hòa', 'Bình nóng lạnh', 'Giường', 'Tủ quần áo'],
    nearby: [
      place('TRANSPORT', 'Ga Thượng Đình (Cát Linh - Hà Đông)', '700 m'),
      place('SCHOOL', 'Trường Đại học Khoa học Tự nhiên', '500 m'),
      place('MARKET', 'Chợ Thượng Đình', '800 m'),
      place('MALL', 'Royal City', '1,5 km'),
    ],
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
      'Căn 3 phòng ngủ, 2 WC, phòng khách và phòng ngủ chính nhìn thẳng ra Hồ Tây. Trần cao, cửa kính lớn ' +
      'nên căn sáng cả ngày, bếp có cửa sổ riêng.\n\n' +
      'Nội khu yên tĩnh, có hồ bơi bốn mùa và khu vui chơi trẻ em. Đi bộ ra đường ven hồ, gần trường ' +
      'Chu Văn An và chợ Bưởi. Phù hợp gia đình muốn ở lâu dài gần trung tâm.',
    legacyDescription:
      'Căn 3 phòng ngủ view Hồ Tây, thiết kế sáng và thoáng. Nội khu yên tĩnh, có hồ bơi bốn mùa ' +
      'và khu vui chơi trẻ em. Phù hợp gia đình muốn ở lâu dài gần trung tâm.',
    bedrooms: 3,
    bathrooms: 2,
    floors: 15,
    direction: 'BAC',
    legalStatus: 'SO_HONG',
    furnishing: 'FULL',
    occupancy: 'VACANT',
    images: [
      unsplash('1665249934445-1de680641f50'),
      unsplash('1774311237295-a65a4c1ff38a'),
      unsplash('1675279200694-8529c73b1fd0'),
      unsplash('1631889993959-41b4e9c6e3c5'),
    ],
    features: ['View hồ', 'Ban công', 'Thang máy', 'Hồ bơi bốn mùa', 'Khu vui chơi trẻ em', 'An ninh 24/7'],
    furniture: ['Sofa', 'Bàn ăn', 'Giường', 'Tủ quần áo', 'Tủ lạnh', 'Điều hòa', 'Bếp từ'],
    nearby: [
      place('PARK', 'Hồ Tây', '100 m'),
      place('SCHOOL', 'Trường THPT Chu Văn An', '1 km'),
      place('MARKET', 'Chợ Bưởi', '1,5 km'),
    ],
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
      'Shophouse 4 tầng mặt phố đi bộ trong "thành phố không ngủ" Grand World, lượng khách du lịch đông quanh năm. ' +
      'Bàn giao thô để chủ mới tự thiết kế theo mục đích kinh doanh.\n\n' +
      'Tầng trệt kinh doanh, các tầng trên gồm 3 phòng ngủ để ở hoặc làm homestay. Gần VinWonders, ' +
      'Safari và bệnh viện Vinmec Phú Quốc.',
    legacyDescription:
      'Shophouse mặt phố đi bộ trong "thành phố không ngủ" Grand World, lượng khách du lịch đông quanh năm. ' +
      'Tầng trệt kinh doanh, các tầng trên ở hoặc làm homestay.',
    bedrooms: 3,
    bathrooms: 4,
    floors: 4,
    landArea: 110,
    floorArea: 400,
    roadWidth: 12,
    direction: 'TAY',
    legalStatus: 'SO_HONG',
    furnishing: 'NONE',
    occupancy: 'VACANT',
    images: [unsplash('1430285561322-7808604715df'), unsplash('1698362695891-8628b6ff6802')],
    features: ['Mặt tiền kinh doanh', 'Phố đi bộ', 'Sân thượng'],
    furniture: [],
    nearby: [
      place('MALL', 'Khu phố Grand World', 'Ngay trước nhà'),
      place('PARK', 'VinWonders Phú Quốc', '2 km'),
      place('OTHER', 'Vinpearl Safari Phú Quốc', '3 km'),
      place('HOSPITAL', 'Bệnh viện Vinmec Phú Quốc', '3 km'),
      place('TRANSPORT', 'Sân bay Phú Quốc', '25 km'),
    ],
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
      'Lô đất 5 x 20 m trong khu đô thị đã hoàn thiện hạ tầng: điện âm, cấp thoát nước, vỉa hè và cây xanh. ' +
      'Đường trước lô rộng 7,5 m, xung quanh đã có nhà dân ở.\n\n' +
      'Gần sông Cổ Cò và cầu Hòa Xuân, xây ở hoặc đầu tư đều phù hợp. Pháp lý sổ đỏ từng lô, sang tên ngay.',
    legacyDescription:
      'Lô đất 5 x 20 m trong khu đô thị đã hoàn thiện hạ tầng, đường 7,5 m. Gần sông Cổ Cò ' +
      'và cầu Hòa Xuân, xây ở hoặc đầu tư đều phù hợp. Pháp lý sổ đỏ từng lô.',
    landArea: 100,
    roadWidth: 7.5,
    direction: 'DONG_NAM',
    legalStatus: 'SO_DO',
    occupancy: 'VACANT',
    images: [],
    features: ['Hạ tầng hoàn thiện', 'Gần sông'],
    furniture: [],
    nearby: [
      place('OTHER', 'Sông Cổ Cò', '300 m'),
      place('TRANSPORT', 'Cầu Hòa Xuân', '1 km'),
      place('SCHOOL', 'Trường học trong khu đô thị', '700 m'),
      place('MARKET', 'Chợ trong khu đô thị', '800 m'),
    ],
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
      'Studio 32 m² gọn gàng: khu ngủ, khu bếp và bàn làm việc chung một không gian, 1 WC. ' +
      'Đủ nội thất, đang có khách thuê ổn định, mua xong nhận tiền thuê ngay.\n\n' +
      'Phù hợp người độc thân hoặc mua để cho thuê. Nội khu có biển hồ nước mặn, trường đại học VinUni ' +
      'và nhiều tiện ích trong bán kính đi bộ.',
    legacyDescription:
      'Studio 32 m² gọn gàng, đủ nội thất, phù hợp người độc thân hoặc mua cho thuê. ' +
      'Nội khu có biển hồ nước mặn, trường đại học VinUni và nhiều tiện ích đi bộ.',
    bedrooms: 0,
    bathrooms: 1,
    floors: 12,
    direction: 'TAY_BAC',
    legalStatus: 'HDMB',
    furnishing: 'FULL',
    occupancy: 'RENTED',
    images: [
      unsplash('1586023492125-27b2c045efd7'),
      unsplash('1493809842364-78817add7ffb'),
      unsplash('1612320648993-61c1cd604b71'),
    ],
    features: ['Thang máy', 'Hồ bơi', 'Biển hồ nước mặn', 'Phòng gym', 'An ninh 24/7'],
    furniture: ['Giường', 'Sofa', 'Tủ lạnh', 'Máy giặt', 'Điều hòa', 'Bếp từ', 'Tivi'],
    nearby: [
      place('PARK', 'Biển hồ nước mặn', '500 m'),
      place('SCHOOL', 'Trường Đại học VinUni', '1 km'),
      place('MALL', 'Vincom Mega Mall Ocean Park', '800 m'),
    ],
    panoramas: [
      { title: 'Không gian chính', url: polyhaven('hotel_room') },
      { title: 'Phòng tắm', url: polyhaven('modern_bathroom') },
    ],
  },
];
