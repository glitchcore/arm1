Базовая статья по архитектуре на викичипе: https://en.wikichip.org/wiki/acorn/microarchitectures/arm1

Инструкция к процессору: http://www.bitsavers.org/pdf/acorn/ARM_Evaluation_Sys_Aug86.pdf

Куча статей от Ken Shirriff http://www.righto.com/search/label/arm?max-results=80

* Про энкодер (http://www.righto.com/2016/01/more-arm1-processor-reverse-engineering.html) и счетчик (http://www.righto.com/2016/01/counting-bits-in-hardware-reverse.html) для ldm/stm операций;
* Про логику управления условным выполнением (которая берет флаги и берет кусок инструкции и дает разрешение на выполнение): http://www.righto.com/2016/01/conditional-instructions-in-arm1.html, а тут про формирование флагов (там же про режимы работы): http://www.righto.com/2016/02/the-arm1-processors-flags-reverse.html 
* Секвенсер/декодер инструкций: http://www.righto.com/2016/02/reverse-engineering-arm1-instruction.html
* Микрокод http://www.righto.com/2016/02/reverse-engineering-arm1-processors.html


Куча статей у Dave's Hacks http://daveshacks.blogspot.com/search/label/arm?max-results=20

* АЛУ http://daveshacks.blogspot.com/2015/12/inside-alu-of-armv1-first-arm.html
* Про устройство регистров, управление регистрами и КЗ в инвертерах http://daveshacks.blogspot.com/2015/12/inside-armv1-register-bank.html
http://daveshacks.blogspot.com/2015/12/inside-armv1-register-bank-register.html
* Разводка шин данных http://daveshacks.blogspot.com/2015/12/inside-armv1-read-bus.html
http://daveshacks.blogspot.com/2016/01/inside-armv1-read-bus-b-alu-output-bus.html
* Схема управления сдвигом и про команды http://daveshacks.blogspot.com/2016/01/inside-armv1-decoding-barrel-shifter.html
* Схема управления АЛУ http://daveshacks.blogspot.com/2016/01/inside-arm1v-alu-control-logic.html
* Еще про микрокод: http://daveshacks.blogspot.com/2016/01/inside-armv1-instruction-decoding-and.html
