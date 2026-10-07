package ktlm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KtlmApplication {

    public static void main(String[] args) {
        SpringApplication.run(KtlmApplication.class, args);
    }

}