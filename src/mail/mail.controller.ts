import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ParseTemplateIdPipe } from '../common/pipes/parse-template-id.pipe';
import { SendMailDto } from './dto/send-mail.dto';
import { MailServiceAuthGuard } from './mail-service-auth.guard';
import { MailService } from './mail.service';

@Controller('mail')
@UseGuards(MailServiceAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send/:templateId')
  async send(
    @Param('templateId', ParseTemplateIdPipe)
    templateId: string,
    @Body() dto: SendMailDto,
  ): Promise<unknown> {
    return this.mailService.send(templateId, dto);
  }
}
