// Các giá trị cố định của thông tin chi tiết căn nhà. Nhãn tiếng Việt nằm ở web (web/src/lib/property.ts)

// Pháp lý: sổ hồng, sổ đỏ, hợp đồng mua bán (chưa có sổ), đang chờ cấp sổ
export const LEGAL_STATUSES = ['SO_HONG', 'SO_DO', 'HDMB', 'CHO_SO'];

// Nội thất: đầy đủ, cơ bản, nhà thô / không nội thất
export const FURNISHINGS = ['FULL', 'BASIC', 'NONE'];

// Tình trạng sử dụng: nhà trống, chủ đang ở, đang cho thuê
export const OCCUPANCIES = ['VACANT', 'OWNER_LIVING', 'RENTED'];

// Hướng nhà (hoặc hướng ban công với căn hộ)
export const DIRECTIONS = ['DONG', 'TAY', 'NAM', 'BAC', 'DONG_BAC', 'DONG_NAM', 'TAY_BAC', 'TAY_NAM'];

// Nhóm dịch vụ xung quanh: trường học, y tế, chợ/siêu thị, trung tâm thương mại, công viên, giao thông, khác
export const NEARBY_CATEGORIES = ['SCHOOL', 'HOSPITAL', 'MARKET', 'MALL', 'PARK', 'TRANSPORT', 'OTHER'];

export const MAX_PANORAMA_ROOMS = 10;
export const MAX_GALLERY_IMAGES = 20;
export const MAX_TAGS = 30;
export const MAX_NEARBY_PLACES = 20;
