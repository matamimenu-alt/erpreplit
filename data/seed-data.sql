--
-- PostgreSQL database dump
--

\restrict 5D1adkb6YB9ZcBFXC5OtejQ0PVbU3xoz8zAW3fpnwWeF5Ld9e9cYpbywqSAT2CY

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.restaurants VALUES (1, 'Asad Al-Hamra', 'أسد الحمراء', '2026-03-24 20:14:05.89471', NULL, NULL, NULL, NULL, NULL, NULL, 'active');
INSERT INTO public.restaurants VALUES (2, 'Sabah Al-El', 'صباح العل', '2026-03-24 20:14:05.928686', NULL, NULL, NULL, NULL, NULL, NULL, 'active');
INSERT INTO public.restaurants VALUES (3, 'Chicken Bar', 'تشيكن بار', '2026-03-24 20:14:05.932641', NULL, NULL, NULL, NULL, NULL, NULL, 'active');
INSERT INTO public.restaurants VALUES (28, 'Test Branch', NULL, '2026-05-17 19:33:41.400291', 'Test Brand', NULL, 'Riyadh', NULL, NULL, NULL, 'archived');


--
-- Data for Name: branch_transfers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: dishes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.dishes VALUES (1, 1, 'Grilled Chicken Breast', 'Main Course', 8.00, 28.00, NULL, '2026-04-02 07:46:16.64223');


--
-- Data for Name: dish_ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.dish_ingredients VALUES (1, 1, 'Chicken Breast', 'kg', 0.3500, '2026-04-02 07:46:16.687447');


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.employees VALUES (8, 'اريبون حسين', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 2000.00, '2026-04-07 13:08:53.218244', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 500.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (1, 'ريم ابراهيم محمد بن هداب', 'Ex.chef', 2050.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 451.22, 0.00, 2050.00, '2026-04-07 13:08:26.594674', 2, 'Ex.chef', true, 'السعودية', NULL, 451.22, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (2, 'ثروت', 'Staff', 6500.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 130.02, 1750.08, 6500.00, '2026-04-07 13:08:30.464703', 2, 'Staff', true, 'تركي', NULL, 130.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (3, 'موسين محمد ساجالا', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:08:34.203683', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (4, 'شاهين حسين', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:08:38.087924', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (5, 'سومانتا داس', 'Staff', 1700.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1700.00, '2026-04-07 13:08:41.836494', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (6, 'مد اسرف', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:08:45.684804', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (7, 'اوسمان الي', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:08:49.451895', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (9, 'مد حسن', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:08:57.390657', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (10, 'ميراج ميا', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:09:01.094618', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (11, 'مد راسيل', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:09:04.929688', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (12, 'انيك هسان', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:09:08.881466', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (13, 'علاء جاب الله', 'Staff', 3000.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 60.02, 1750.08, 3000.00, '2026-04-07 13:09:12.633271', 2, 'Staff', true, 'مصر', NULL, 60.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (14, 'محمد فيصل', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1500.00, '2026-04-07 13:09:16.85131', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (15, 'فيصل العميسي', 'Staff', 1600.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1600.00, '2026-04-07 13:09:20.589581', 2, 'Staff', true, 'اليمن', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (16, 'سلطان الحداد', 'Staff', 500.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 500.00, '2026-04-07 13:09:24.44181', 2, 'Staff', true, 'اليمن', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (17, 'مطهر بقار', 'Staff', 1600.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1600.00, '2026-04-07 13:09:28.302699', 2, 'Staff', true, 'اليمن', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (18, 'ايمن طه', 'Staff', 1700.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1700.00, '2026-04-07 13:09:32.22137', 2, 'Staff', true, 'اليمن', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (19, 'سهيل اسلام', 'Staff', 2700.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 2700.00, '2026-04-07 13:09:36.051424', 2, 'Staff', true, 'اليمن', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (20, 'رضا احمد', 'Staff', 3000.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 60.02, 1750.08, 3000.00, '2026-04-07 13:09:39.896146', 2, 'Staff', true, 'مصر', NULL, 60.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (21, 'رجب حسين', 'Staff', 1500.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 30.02, 1750.08, 1500.00, '2026-04-07 13:09:43.867938', 2, 'Staff', true, 'بنجلاديش', NULL, 30.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (22, 'سيدالله جول زادا', 'Staff', 1600.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 32.02, 1750.08, 1600.00, '2026-04-07 13:09:47.869186', 2, 'Staff', true, 'باكستان', NULL, 32.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (23, 'اسلام حاسيفول', 'Staff', 1300.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 1750.08, 1300.00, '2026-04-07 13:09:51.631499', 2, 'Staff', true, 'بنجلاديش', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (24, 'مد جمال الدين بوهيان', 'Staff', 1300.00, NULL, NULL, NULL, 0.0, 0.00, 782.40, 26.02, 1750.08, 1300.00, '2026-04-07 13:09:55.437533', 2, 'Staff', true, 'بنجلاديش', NULL, 26.02, 800.00, 649.99, 0.00, 0.00, 0.00, 0.00);
INSERT INTO public.employees VALUES (25, 'Mohammed Ali', 'Head Chef', 7100.00, NULL, NULL, NULL, 0.0, 0.00, 0.00, 0.00, 0.00, 7400.00, '2026-04-21 11:24:15.514154', 1, 'Head Chef', true, '', NULL, 0.00, 0.00, 0.00, 0.00, 600.00, 300.00, 0.00);


--
-- Data for Name: fixed_cost_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fixed_cost_templates VALUES (2, 1, 'staff-salaries', 'Monthly Salaries', 45000.00, NULL, true, 0, '2026-05-06 18:22:30.744288', '2026-05-06 18:22:30.744288', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (3, 2, 'operating', 'Owner Monthly Contract', 20000.00, 'المالك شهري تعاقد [migrated from legacy expenses #11]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (4, 2, 'accommodation', 'Staff Accommodation Rent', 4167.00, 'تكلفة – إيجار سكن الموظفين [migrated from legacy expenses #3]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (5, 2, 'utilities', 'Staff Accommodation Energy', 750.00, 'تكلفة – طاقة سكن الموظفين (كهرباء/مياه) [migrated from legacy expenses #4]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (6, 2, 'operating', 'Bank Charges', 1500.00, 'تكلفة – الرسوم البنكية [migrated from legacy expenses #7]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (7, 2, 'operating', 'Staff Municipality ID', 1358.33, 'تكلفة – هوية البلدية للموظفين [migrated from legacy expenses #5]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (8, 2, 'operating', 'System Contract Services', 666.67, 'تكلفة – خدمات عقود الأنظمة [migrated from legacy expenses #8]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (9, 1, 'staff-expenses', 'Iqama Renewal', 1500.00, 'Test staff expense [migrated from legacy expenses #14]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (10, 1, 'staff-expenses', 'Iqama Renewal', 200.00, 'Ahmed''s iqama [migrated from legacy expenses #13]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (11, 2, 'operating', 'Laundry & Dry Cleaning', 600.00, 'تكلفة – الغسيل والتنظيف الجاف [migrated from legacy expenses #9]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (12, 2, 'operating', 'Car & Bus Insurance', 250.00, 'تكلفة – تأمين السيارات والحافلات [migrated from legacy expenses #6]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (13, 2, 'operating', 'Licenses & Permits', 1108.33, 'تكلفة – التراخيص والتصاريح [migrated from legacy expenses #1]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (14, 2, 'operating', 'Miscellaneous Expenses', 1000.00, 'تكلفة – مصروفات متنوعة [migrated from legacy expenses #12]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (15, 2, 'operating', 'Contract Cleaning', 2000.00, 'تكلفة – التنظيف التعاقدي [migrated from legacy expenses #10]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');
INSERT INTO public.fixed_cost_templates VALUES (16, 2, 'rent', 'Shop Rent', 23696.00, 'تكلفة – إيجار المحل [migrated from legacy expenses #2]', true, 0, '2026-05-21 14:28:35.529554', '2026-05-21 14:28:35.529554', 'none', 15.00, 'fixed');


--
-- Data for Name: expense_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expense_audit_logs VALUES (2, 1, 2, 'Monthly Salaries', NULL, 'create_template', NULL, 45000.00, 'admin', '2026-05-06 18:22:30.785644', NULL);
INSERT INTO public.expense_audit_logs VALUES (4, 1, NULL, NULL, '2026-05', 'lock_month', NULL, NULL, 'admin', '2026-05-06 18:23:53.356861', 'Month 2026-05 locked');
INSERT INTO public.expense_audit_logs VALUES (5, 1, NULL, NULL, '2026-05', 'unlock_month', NULL, NULL, 'admin', '2026-05-06 18:25:15.65243', 'Month 2026-05 unlocked');
INSERT INTO public.expense_audit_logs VALUES (6, 1, NULL, NULL, '2026-05', 'lock_month', NULL, NULL, 'admin', '2026-05-06 18:25:28.553601', 'Month 2026-05 locked');
INSERT INTO public.expense_audit_logs VALUES (7, 1, NULL, NULL, '2026-05', 'unlock_month', NULL, NULL, 'admin', '2026-05-06 18:25:34.847818', 'Month 2026-05 unlocked');


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expense_categories VALUES (1, '5', 'Expenses', 'المصروفات', NULL, 0, 0, true, '2026-05-19 14:58:06.2151', NULL);
INSERT INTO public.expense_categories VALUES (2, '5-1', 'HR & Employee Costs', 'تكاليف الموظفين والموارد البشرية', '5', 1, 1, true, '2026-05-19 14:58:06.252032', NULL);
INSERT INTO public.expense_categories VALUES (3, '5-2', 'Government & Legal', 'المصروفات الحكومية والقانونية', '5', 1, 2, true, '2026-05-19 14:58:06.259406', NULL);
INSERT INTO public.expense_categories VALUES (4, '5-3', 'Fixed Operating Costs', 'تكاليف التشغيل الثابتة', '5', 1, 3, true, '2026-05-19 14:58:06.26574', NULL);
INSERT INTO public.expense_categories VALUES (5, '5-4', 'Variable Operating Costs', 'تكاليف التشغيل المتغيرة', '5', 1, 4, true, '2026-05-19 14:58:06.270832', NULL);
INSERT INTO public.expense_categories VALUES (6, '5-5', 'Marketing & Sales', 'التسويق والمبيعات', '5', 1, 5, true, '2026-05-19 14:58:06.277378', NULL);
INSERT INTO public.expense_categories VALUES (7, '5-6', 'Repairs & Maintenance', 'الإصلاح والصيانة', '5', 1, 6, true, '2026-05-19 14:58:06.28367', NULL);
INSERT INTO public.expense_categories VALUES (8, '5-7', 'Administrative Expenses', 'المصروفات الإدارية', '5', 1, 7, true, '2026-05-19 14:58:06.289786', NULL);
INSERT INTO public.expense_categories VALUES (9, '5-8', 'Other Expenses', 'مصروفات أخرى', '5', 1, 8, false, '2026-05-19 14:58:06.29517', NULL);
INSERT INTO public.expense_categories VALUES (10, '5-1-1', 'Salaries & Wages', 'الرواتب والأجور', '5-1', 2, 1, true, '2026-05-19 14:58:06.301798', 'fixed');
INSERT INTO public.expense_categories VALUES (11, '5-1-2', 'Overtime', 'العمل الإضافي', '5-1', 2, 2, true, '2026-05-19 14:58:06.307917', 'variable');
INSERT INTO public.expense_categories VALUES (12, '5-1-3', 'Vacation Allowances', 'بدلات الإجازات', '5-1', 2, 3, true, '2026-05-19 14:58:06.317145', 'fixed');
INSERT INTO public.expense_categories VALUES (13, '5-1-4', 'Air Tickets / Travel', 'تذاكر السفر', '5-1', 2, 4, true, '2026-05-19 14:58:06.323219', 'variable');
INSERT INTO public.expense_categories VALUES (14, '5-1-5', 'Employee Meals', 'وجبات الموظفين', '5-1', 2, 5, true, '2026-05-19 14:58:06.330565', 'variable');
INSERT INTO public.expense_categories VALUES (15, '5-1-6', 'Staff Accommodation', 'سكن الموظفين', '5-1', 2, 6, true, '2026-05-19 14:58:06.336569', 'fixed');
INSERT INTO public.expense_categories VALUES (16, '5-2-1', 'Iqama Fees', 'رسوم الإقامة', '5-2', 2, 1, true, '2026-05-19 14:58:06.343182', 'fixed');
INSERT INTO public.expense_categories VALUES (17, '5-2-2', 'GOSI / Social Insurance', 'التأمينات الاجتماعية', '5-2', 2, 2, true, '2026-05-19 14:58:06.350117', 'fixed');
INSERT INTO public.expense_categories VALUES (18, '5-2-3', 'Municipality Licenses', 'تراخيص البلدية', '5-2', 2, 3, true, '2026-05-19 14:58:06.356412', 'fixed');
INSERT INTO public.expense_categories VALUES (19, '5-2-4', 'Commercial Registration', 'السجل التجاري', '5-2', 2, 4, true, '2026-05-19 14:58:06.363583', 'fixed');
INSERT INTO public.expense_categories VALUES (20, '5-2-5', 'Chamber of Commerce', 'الغرفة التجارية', '5-2', 2, 5, true, '2026-05-19 14:58:06.369578', 'fixed');
INSERT INTO public.expense_categories VALUES (21, '5-2-6', 'Visa Costs', 'رسوم التأشيرات', '5-2', 2, 6, true, '2026-05-19 14:58:06.37662', 'variable');
INSERT INTO public.expense_categories VALUES (22, '5-2-7', 'Passport Services', 'خدمات الجوازات', '5-2', 2, 7, true, '2026-05-19 14:58:06.381747', 'variable');
INSERT INTO public.expense_categories VALUES (23, '5-3-1', 'Rent', 'الإيجار', '5-3', 2, 1, true, '2026-05-19 14:58:06.388026', 'fixed');
INSERT INTO public.expense_categories VALUES (24, '5-3-2', 'Internet', 'الإنترنت', '5-3', 2, 2, true, '2026-05-19 14:58:06.393493', 'fixed');
INSERT INTO public.expense_categories VALUES (25, '5-3-3', 'Software Subscriptions', 'اشتراكات البرامج', '5-3', 2, 3, true, '2026-05-19 14:58:06.3988', 'fixed');
INSERT INTO public.expense_categories VALUES (26, '5-3-4', 'Insurance', 'التأمين', '5-3', 2, 4, true, '2026-05-19 14:58:06.406091', 'fixed');
INSERT INTO public.expense_categories VALUES (27, '5-4-1', 'Electricity', 'الكهرباء', '5-4', 2, 1, true, '2026-05-19 14:58:06.411501', 'variable');
INSERT INTO public.expense_categories VALUES (28, '5-4-2', 'Water', 'المياه', '5-4', 2, 2, true, '2026-05-19 14:58:06.417655', 'variable');
INSERT INTO public.expense_categories VALUES (29, '5-4-3', 'Gas', 'الغاز', '5-4', 2, 3, true, '2026-05-19 14:58:06.42313', 'variable');
INSERT INTO public.expense_categories VALUES (30, '5-4-4', 'Fuel', 'الوقود', '5-4', 2, 4, true, '2026-05-19 14:58:06.429385', 'variable');
INSERT INTO public.expense_categories VALUES (38, '5-8-1', 'Donations', 'تبرعات', '5-8', 2, 1, false, '2026-05-19 14:58:06.478327', 'variable');
INSERT INTO public.expense_categories VALUES (39, '5-8-2', 'Losses & Miscellaneous', 'خسائر ومصاريف متنوعة', '5-8', 2, 2, false, '2026-05-19 14:58:06.484341', 'variable');
INSERT INTO public.expense_categories VALUES (40, '5-1-7', 'End of Service', 'مكافأة نهاية الخدمة', '5-1', 2, 7, true, '2026-05-21 22:44:59.782987', 'fixed');
INSERT INTO public.expense_categories VALUES (55, '5-1-8', 'Medical Insurance', 'التأمين الطبي', '5-1', 2, 8, true, '2026-05-21 22:52:15.462291', 'fixed');
INSERT INTO public.expense_categories VALUES (56, '5-1-9', 'Recruitment Costs', 'تكاليف التوظيف', '5-1', 2, 9, true, '2026-05-21 22:52:23.936065', 'variable');
INSERT INTO public.expense_categories VALUES (57, '5-1-10', 'Training', 'التدريب', '5-1', 2, 10, true, '2026-05-21 22:52:28.117403', 'variable');
INSERT INTO public.expense_categories VALUES (65, '5-2-8', 'Government Platforms', 'المنصات الحكومية', '5-2', 2, 8, true, '2026-05-21 22:53:01.5456', 'variable');
INSERT INTO public.expense_categories VALUES (66, '5-2-9', 'Legal Fees', 'الرسوم القانونية', '5-2', 2, 9, true, '2026-05-21 22:53:05.730534', 'variable');
INSERT INTO public.expense_categories VALUES (71, '5-3-5', 'Security Contracts', 'عقود الأمن', '5-3', 2, 5, true, '2026-05-21 22:53:26.809225', 'fixed');
INSERT INTO public.expense_categories VALUES (72, '5-3-6', 'Maintenance Contracts', 'عقود الصيانة', '5-3', 2, 6, true, '2026-05-21 22:53:31.559227', 'fixed');
INSERT INTO public.expense_categories VALUES (73, '5-3-7', 'Accounting Systems', 'أنظمة المحاسبة', '5-3', 2, 7, true, '2026-05-21 22:53:35.747906', 'fixed');
INSERT INTO public.expense_categories VALUES (74, '5-3-8', 'POS Systems', 'أنظمة نقاط البيع', '5-3', 2, 8, true, '2026-05-21 22:53:39.973516', 'fixed');
INSERT INTO public.expense_categories VALUES (79, '5-4-5', 'Packaging', 'التغليف', '5-4', 2, 5, true, '2026-05-21 22:54:00.815467', 'variable');
INSERT INTO public.expense_categories VALUES (80, '5-4-6', 'Cleaning Materials', 'مواد التنظيف', '5-4', 2, 6, true, '2026-05-21 22:54:04.97388', 'variable');
INSERT INTO public.expense_categories VALUES (81, '5-4-7', 'Laundry', 'المغسلة', '5-4', 2, 7, true, '2026-05-21 22:54:09.492765', 'variable');
INSERT INTO public.expense_categories VALUES (82, '5-4-8', 'Kitchen Consumables', 'مستهلكات المطبخ', '5-4', 2, 8, true, '2026-05-21 22:54:13.639657', 'variable');
INSERT INTO public.expense_categories VALUES (83, '5-4-9', 'Smallwares', 'الأدوات الصغيرة', '5-4', 2, 9, true, '2026-05-21 22:54:17.623848', 'variable');
INSERT INTO public.expense_categories VALUES (84, '5-4-10', 'Delivery Expenses', 'مصاريف التوصيل', '5-4', 2, 10, true, '2026-05-21 22:54:21.791419', 'variable');
INSERT INTO public.expense_categories VALUES (31, '5-5-1', 'Social Media Ads', 'إعلانات التواصل الاجتماعي', '5-5', 2, 1, true, '2026-05-19 14:58:06.434756', 'variable');
INSERT INTO public.expense_categories VALUES (32, '5-5-2', 'Influencer Marketing', 'تسويق المؤثرين', '5-5', 2, 2, true, '2026-05-19 14:58:06.441018', 'variable');
INSERT INTO public.expense_categories VALUES (87, '5-5-3', 'Printing', 'الطباعة', '5-5', 2, 3, true, '2026-05-21 22:54:34.51915', 'variable');
INSERT INTO public.expense_categories VALUES (88, '5-5-4', 'Photography', 'التصوير', '5-5', 2, 4, true, '2026-05-21 22:54:38.638207', 'variable');
INSERT INTO public.expense_categories VALUES (89, '5-5-5', 'Promotions & Discounts', 'العروض والخصومات', '5-5', 2, 5, true, '2026-05-21 22:54:42.664487', 'variable');
INSERT INTO public.expense_categories VALUES (90, '5-5-6', 'Talabat / HungerStation Commissions', 'عمولات طلبات وهنقرستيشن', '5-5', 2, 6, true, '2026-05-21 22:54:46.850868', 'variable');
INSERT INTO public.expense_categories VALUES (33, '5-6-1', 'Equipment Maintenance', 'صيانة المعدات', '5-6', 2, 1, true, '2026-05-19 14:58:06.447019', 'variable');
INSERT INTO public.expense_categories VALUES (34, '5-6-2', 'AC Maintenance', 'صيانة المكيفات', '5-6', 2, 2, true, '2026-05-19 14:58:06.453284', 'variable');
INSERT INTO public.expense_categories VALUES (35, '5-6-3', 'Plumbing', 'السباكة', '5-6', 2, 3, true, '2026-05-19 14:58:06.459261', 'variable');
INSERT INTO public.expense_categories VALUES (94, '5-6-4', 'Electrical Repairs', 'الإصلاحات الكهربائية', '5-6', 2, 4, true, '2026-05-21 22:55:03.408499', 'variable');
INSERT INTO public.expense_categories VALUES (95, '5-6-5', 'Emergency Repairs', 'الإصلاحات الطارئة', '5-6', 2, 5, true, '2026-05-21 22:55:07.559006', 'variable');
INSERT INTO public.expense_categories VALUES (36, '5-7-1', 'Office Supplies', 'اللوازم المكتبية', '5-7', 2, 1, true, '2026-05-19 14:58:06.464655', 'variable');
INSERT INTO public.expense_categories VALUES (37, '5-7-2', 'Stationery', 'القرطاسية', '5-7', 2, 2, true, '2026-05-19 14:58:06.471384', 'variable');
INSERT INTO public.expense_categories VALUES (98, '5-7-3', 'Bank Charges', 'الرسوم البنكية', '5-7', 2, 3, true, '2026-05-21 22:55:20.143559', 'variable');
INSERT INTO public.expense_categories VALUES (99, '5-7-4', 'Communication Expenses', 'مصاريف الاتصالات', '5-7', 2, 4, true, '2026-05-21 22:55:24.229644', 'variable');
INSERT INTO public.expense_categories VALUES (100, '5-7-5', 'Courier Services', 'خدمات البريد السريع', '5-7', 2, 5, true, '2026-05-21 22:55:28.368404', 'variable');


--
-- Data for Name: expense_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expense_transactions VALUES (1, 1, '2026-05-17', '2026-05', '5-3-1', 'Branch Rent - May 2026', NULL, 15000.00, true, 15.00, 2250.00, 17250.00, 'Asad Al-Hamra', NULL, NULL, '2026-05-19 14:58:22.626246', '2026-05-19 14:58:22.626246', NULL, NULL, false, 'none');
INSERT INTO public.expense_transactions VALUES (2, 1, '2026-05-17', '2026-05', '5-3-1', 'Branch Rent - May 2026', NULL, 15000.00, true, 15.00, 2250.00, 17250.00, 'Main', NULL, NULL, '2026-05-19 14:58:30.537499', '2026-05-19 14:58:30.537499', NULL, NULL, false, 'none');
INSERT INTO public.expense_transactions VALUES (3, 1, '2026-05-15', '2026-05', '5-4-6', 'Test cleaning VAT-included', NULL, 1000.00, true, 15.00, 150.00, 1150.00, NULL, NULL, NULL, '2026-05-20 08:41:08.126874', '2026-05-20 08:41:08.126874', NULL, NULL, false, 'included');
INSERT INTO public.expense_transactions VALUES (4, 1, '2026-05-15', '2026-05', '5-5-1', 'Test marketing +15%', NULL, 1000.00, true, 15.00, 150.00, 1150.00, NULL, NULL, NULL, '2026-05-20 08:41:08.182224', '2026-05-20 08:41:08.182224', NULL, NULL, false, 'excluded');
INSERT INTO public.expense_transactions VALUES (5, 1, '2026-05-15', '2026-05', '5-2-8', 'Test labor office exempt', NULL, 500.00, false, 0.00, 0.00, 500.00, NULL, NULL, NULL, '2026-05-20 08:41:08.242553', '2026-05-20 08:41:08.242553', NULL, NULL, false, 'none');
INSERT INTO public.expense_transactions VALUES (6, 1, '2026-05-15', '2026-05', '5-4-6', 'Test cleaning included', NULL, 1000.00, true, 15.00, 150.00, 1150.00, NULL, NULL, NULL, '2026-05-20 08:41:21.011985', '2026-05-20 08:41:21.011985', NULL, NULL, false, 'included');
INSERT INTO public.expense_transactions VALUES (7, 1, '2026-05-15', '2026-05', '5-5-1', 'Test marketing excluded', NULL, 1000.00, true, 15.00, 150.00, 1150.00, NULL, NULL, NULL, '2026-05-20 08:41:21.212393', '2026-05-20 08:41:21.212393', NULL, NULL, false, 'excluded');
INSERT INTO public.expense_transactions VALUES (8, 1, '2026-05-15', '2026-05', '5-2-8', 'Labor office exempt', NULL, 500.00, false, 0.00, 0.00, 500.00, NULL, NULL, NULL, '2026-05-20 08:41:21.39445', '2026-05-20 08:41:21.39445', NULL, NULL, false, 'none');
INSERT INTO public.expense_transactions VALUES (9, 1, '2026-05-15', '2026-05', '5-2-8', 'Government fee exempt', NULL, 1000.00, false, 0.00, 0.00, 1000.00, NULL, NULL, NULL, '2026-05-20 08:43:42.373931', '2026-05-20 08:43:42.373931', NULL, NULL, false, 'none');
INSERT INTO public.expense_transactions VALUES (10, 1, '2026-05-21', '2026-05', '5-4-5', 'box order', NULL, 100.00, false, 0.00, 0.00, 100.00, NULL, NULL, NULL, '2026-05-21 22:45:07.420258', '2026-05-21 22:45:07.420258', NULL, NULL, false, 'none');


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: fixed_cost_monthly_values; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: monthly_closing_status; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.monthly_closing_status VALUES (1, 1, '2026-05', false, NULL, NULL, NULL, '2026-05-06 18:23:53.319137');


--
-- Data for Name: pricing_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pricing_config VALUES (1, 1, 1000, 7.00, 25.00, '2026-04-02 07:41:45.941715');
INSERT INTO public.pricing_config VALUES (2, 1, 1000, 7.00, 25.00, '2026-04-02 07:41:45.942316');


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.purchases VALUES (14, '2026-04-18', '', 'Chicken Breast', 10.000, 50.00, false, 500.00, 75.00, 575.00, '2026-04-18 09:09:37.128821', 'food-poultry', 1, NULL, 'cash', 'tax', '7226a22c-c2ab-40cc-b9c0-32067b8efebb', 'unit');
INSERT INTO public.purchases VALUES (15, '2026-04-18', '', 'Mineral Water', 5.000, 20.00, false, 100.00, 15.00, 115.00, '2026-04-18 09:09:37.306376', 'food-poultry', 1, NULL, 'cash', 'tax', '7226a22c-c2ab-40cc-b9c0-32067b8efebb', 'unit');
INSERT INTO public.purchases VALUES (16, '2026-04-18', '', 'Chicken Breast', 3.000, 50.00, false, 150.00, 22.50, 172.50, '2026-04-18 09:37:11.722754', 'food-poultry', 1, NULL, 'cash', 'tax', 'f07cf793-10f1-4d99-8dc5-9bf0f5b43f77', 'unit');
INSERT INTO public.purchases VALUES (17, '2026-05-11', 'Test Supplier', 'Rice', 10.000, 50.00, false, 500.00, 75.00, 575.00, '2026-05-11 17:21:21.475784', 'food', 1, NULL, 'cash', 'tax', 'test-001', 'kg');
INSERT INTO public.purchases VALUES (18, '2026-05-11', '', 'Chicken', 5.000, 30.00, false, 150.00, 22.50, 172.50, '2026-05-11 17:22:51.027702', 'food-poultry', 1, NULL, 'cash', 'tax', 'test-002', 'kg');
INSERT INTO public.purchases VALUES (19, '2026-05-11', '', 'Chicken', 5.000, 30.00, true, 130.43, 19.57, 150.00, '2026-05-11 17:32:40.712181', 'food-poultry', 1, NULL, 'cash', 'tax', 'd75e29ca-dce5-4b07-b3e0-afe38c517a3d', 'unit');


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sales VALUES (2, 1, '2026-05-15', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'exclusive', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, NULL, '2026-05-20 09:01:24.518526');
INSERT INTO public.sales VALUES (3, 1, '2026-05-15', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'exclusive', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, NULL, '2026-05-20 09:01:34.238075');


--
-- Data for Name: sales_app_config; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stock_movements VALUES (14, 1, 'Chicken Breast', 'food-poultry', NULL, 'unit', 'purchase', 10.000, 50.00, 500.00, '2026-04-18', 'purchase', 14, NULL, '2026-04-18 09:09:37.301397');
INSERT INTO public.stock_movements VALUES (15, 1, 'Mineral Water', 'food-poultry', NULL, 'unit', 'purchase', 5.000, 20.00, 100.00, '2026-04-18', 'purchase', 15, NULL, '2026-04-18 09:09:37.310023');
INSERT INTO public.stock_movements VALUES (16, 1, 'Chicken Breast', 'food-poultry', NULL, 'unit', 'purchase', 3.000, 50.00, 150.00, '2026-04-18', 'purchase', 16, NULL, '2026-04-18 09:37:12.040223');
INSERT INTO public.stock_movements VALUES (17, 1, 'Rice', 'food', NULL, 'kg', 'purchase', 10.000, 50.00, 500.00, '2026-05-11', 'purchase', 17, NULL, '2026-05-11 17:21:21.524331');
INSERT INTO public.stock_movements VALUES (18, 1, 'Chicken', 'food-poultry', NULL, 'kg', 'purchase', 5.000, 30.00, 150.00, '2026-05-11', 'purchase', 18, NULL, '2026-05-11 17:22:51.063672');
INSERT INTO public.stock_movements VALUES (19, 1, 'Chicken', 'food-poultry', NULL, 'unit', 'purchase', 5.000, 30.00, 130.43, '2026-05-11', 'purchase', 19, NULL, '2026-05-11 17:32:40.749271');


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: supplier_products; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: branch_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branch_transfers_id_seq', 1, false);


--
-- Name: dish_ingredients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dish_ingredients_id_seq', 1, true);


--
-- Name: dishes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dishes_id_seq', 1, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 25, true);


--
-- Name: expense_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_audit_logs_id_seq', 8, true);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_categories_id_seq', 100, true);


--
-- Name: expense_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_transactions_id_seq', 10, true);


--
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expenses_id_seq', 14, true);


--
-- Name: fixed_cost_monthly_values_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fixed_cost_monthly_values_id_seq', 1, true);


--
-- Name: fixed_cost_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fixed_cost_templates_id_seq', 16, true);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_id_seq', 1, false);


--
-- Name: monthly_closing_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.monthly_closing_status_id_seq', 1, true);


--
-- Name: pricing_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pricing_config_id_seq', 2, true);


--
-- Name: purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchases_id_seq', 19, true);


--
-- Name: restaurants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurants_id_seq', 28, true);


--
-- Name: sales_app_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_app_config_id_seq', 1, false);


--
-- Name: sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_id_seq', 3, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 19, true);


--
-- Name: supplier_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_products_id_seq', 1, true);


--
-- Name: supplier_products_supplier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_products_supplier_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict 5D1adkb6YB9ZcBFXC5OtejQ0PVbU3xoz8zAW3fpnwWeF5Ld9e9cYpbywqSAT2CY

