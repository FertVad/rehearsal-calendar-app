# Финальная сверка покрытия — availability и shared/constants

Дата: 2026-09-15. Только чтение; исходники, тесты, скрипты и сборки не запускались и не менялись. Новых подтверждённых findings: **0**. Пути ниже относительно `rehearsal-calendar-native/src/`.

## Повторно использованное полное покрытие C

`audit/notes-availability-client.md:72–77` явно фиксирует полное чтение всех implementations hooks/utils/constants и шести компонентов. Поэтому следующие файлы уже покрыты C и не перечитывались заново ради увеличения объёма:

- `features/availability/components/editor/ModeInfo.tsx` — 47 строк.
- `features/availability/components/editor/ModeSelector.tsx` — 125.
- `features/availability/components/editor/TimeSlotsEditor.tsx` — 173.
- `features/availability/components/modals/TimePickerModal.tsx` — 105.
- `features/availability/hooks/useAvailabilitySync.ts` — 117.
- `features/availability/utils/slotHelpers.ts` — 20.
- `features/availability/constants/availabilityConstants.ts` — 26; этот небольшой файл дополнительно полностью прочитан сейчас для стыка с общими константами.

Сравнение `git diff 25475e8..0f655e2` для этих семи путей пустое. Текущее поисковое чтение импортов подтверждает известную границу: Screen использует ModeInfo и useAvailabilitySync, а standalone ModeSelector/TimeSlotsEditor/TimePickerModal не импортирует. Эта разница с отдельными component tests уже отражена в C:88, не новый finding. Всего 613 строк availability относятся к уже имевшемуся полному покрытию, не к новому объёму чтения.

## Новое полное чтение shared/constants

- `shared/constants/colors.ts` — 59 строк: токены цвета и совместимые re-export Spacing/BorderRadius/FontSize/FontWeight.
- `shared/constants/spacing.ts` — 20: значения отступов и радиусов.
- `shared/constants/typography.ts` — 21: размеры и строковые font-weight.
- `shared/constants/timezones.ts` — 113: curated options, получение device timezone, dynamic IANA label/offset, fallback при Intl exception.

Итого новых полностью прочитанных файлов — 4 / 213 строк. Плюс повторно прочитаны 26 строк availabilityConstants. Поиск callers timezone helpers ограничен src: getTimezonesWithDevice/getTimezoneLabel используются ProfileScreen/CreateProjectScreen; эти screens уже покрыты H/B и заново полностью не читались.

`timezones.ts:6–7` явно заявляет standard-time offsets в curated labels; :97 возвращает такую запись для известных зон, тогда как :62–65 вычисляет текущий offset только для динамической зоны. Это может быть непонятно пользователю во время DST, но отсутствие обещания «текущий offset» у curated label и отсутствие влияния labels на сохраняемый IANA value не позволяют считать новую арифметическую ошибку. Здесь не проверялась актуальность IANA базы ОС, все нынешние региональные DST правила или полная лингвистика названий. Невалидный IANA input не падает на display path: :68–69 возвращает пустой offset и выводится city. Validity producer/server уже относится к B/H.

## Честные исключения

Component tests `ModeSelector.test.tsx`, `TimeSlotsEditor.test.tsx`, utils test `displayedMode.test.ts` в исходной C-заметке отмечены непрочитанными; этот проход их не добирал и не повышает покрытие тестов до полного. Styles/визуальное качество, WCAG claims комментария colors:17 и поведение layout после resize/orientation runtime не проверялись. Константы размеров читают Dimensions единожды (`availabilityConstants.ts:7–9`); достаточного отдельного воспроизводимого сценария после уже учтённых UI ограничений здесь не подтверждено. Все найденные CC/C проблемы остаются в исходных заметках; дубликаты не начисляются.
